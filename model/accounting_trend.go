/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

import (
	"errors"
	"math"
	"time"

	"gorm.io/gorm"
)

var ErrInvalidAccountingGranularity = errors.New("invalid accounting time granularity")

// AccountingTrendPoint 的 Time 为服务端当地时间桶的开始日期，金额为人民币分。
type AccountingTrendPoint struct {
	Time              string `json:"time"`
	TotalIncomeCents  int64  `json:"total_income_cents"`
	TotalExpenseCents int64  `json:"total_expense_cents"`
	GrossProfitCents  int64  `json:"gross_profit_cents"`
}

type AccountingTrend struct {
	Granularity string                 `json:"granularity"`
	Items       []AccountingTrendPoint `json:"items"`
}

// accountingPeriodStart 保持日、周、月的日历边界，周从周一开始。
func accountingPeriodStart(timestamp int64, granularity string) time.Time {
	date := time.Unix(timestamp, 0).In(time.Local)
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	if granularity == "month" {
		return time.Date(date.Year(), date.Month(), 1, 0, 0, 0, 0, date.Location())
	}
	if granularity == "week" {
		return start.AddDate(0, 0, -((int(date.Weekday()) + 6) % 7))
	}
	return start
}

// GetAccountingTrend 流式读取账单并在 Go 中按日历聚合，避免依赖数据库日期函数。
func GetAccountingTrend(filter AccountingTimeFilter, granularity string) (AccountingTrend, error) {
	result := AccountingTrend{Granularity: granularity, Items: []AccountingTrendPoint{}}
	if granularity != "day" && granularity != "week" && granularity != "month" {
		return result, ErrInvalidAccountingGranularity
	}
	if filter.StartTime < 0 || filter.EndTime < 0 || (filter.EndTime > 0 && filter.StartTime > filter.EndTime) {
		return result, ErrInvalidAccountingTime
	}
	for _, timestamp := range []int64{filter.StartTime, filter.EndTime} {
		if timestamp > 0 && time.Unix(timestamp, 0).Year() > 9999 {
			return result, ErrInvalidAccountingTime
		}
	}

	sources := []*gorm.DB{
		accountingTopUpIncomeQuery(filter).Select("create_time", "money"),
		accountingSubscriptionIncomeQuery(filter).Select("create_time", "money"),
		applyAccountingTimeFilter(DB.Model(&AccountingEntry{}).Where("kind IN ?", []string{AccountingKindOfflineIncome, AccountingKindExpense}), "create_time", filter).
			Select("create_time", "amount_cents", "kind"),
	}
	periods := make(map[int64]AccountingTrendPoint)
	var firstTime, lastTime int64
	for _, query := range sources {
		rows, err := query.Rows()
		if err != nil {
			return result, err
		}
		for rows.Next() {
			var entry struct {
				CreateTime  int64
				Money       float64
				AmountCents int64
				Kind        string
			}
			if err := DB.ScanRows(rows, &entry); err != nil {
				rows.Close()
				return result, err
			}
			if entry.CreateTime <= 0 || time.Unix(entry.CreateTime, 0).Year() > 9999 {
				rows.Close()
				return result, ErrInvalidAccountingTime
			}
			cents := entry.AmountCents
			if entry.Kind == "" {
				if math.IsNaN(entry.Money) || math.IsInf(entry.Money, 0) || math.Abs(entry.Money) > float64(1<<53-1)/100 {
					rows.Close()
					return result, ErrInvalidAccountingAmount
				}
				cents = accountingMoneyToCents(entry.Money)
			}
			period := accountingPeriodStart(entry.CreateTime, granularity)
			point := periods[period.Unix()]
			point.Time = period.Format("2006-01-02")
			total := point.TotalIncomeCents
			if entry.Kind == AccountingKindExpense {
				total = point.TotalExpenseCents
			}
			// 响应必须保持 JavaScript 安全整数精度，不允许汇总溢出或静默舍入。
			if cents < 0 || cents > (1<<53-1)-total {
				rows.Close()
				return result, errors.New("accounting total exceeds supported amount range")
			}
			if entry.Kind == AccountingKindExpense {
				point.TotalExpenseCents += cents
			} else {
				point.TotalIncomeCents += cents
			}
			point.GrossProfitCents = point.TotalIncomeCents - point.TotalExpenseCents
			periods[period.Unix()] = point
			if firstTime == 0 || entry.CreateTime < firstTime {
				firstTime = entry.CreateTime
			}
			lastTime = max(lastTime, entry.CreateTime)
		}
		err = rows.Err()
		closeErr := rows.Close()
		if err != nil {
			return result, err
		}
		if closeErr != nil {
			return result, closeErr
		}
	}
	if len(periods) == 0 {
		return result, nil
	}
	if filter.StartTime > 0 {
		firstTime = filter.StartTime
	}
	if filter.EndTime > 0 {
		lastTime = filter.EndTime
	}
	monthStep, dayStep := 0, 1
	if granularity == "week" {
		dayStep = 7
	}
	if granularity == "month" {
		monthStep, dayStep = 1, 0
	}
	end := accountingPeriodStart(lastTime, granularity)
	for period := accountingPeriodStart(firstTime, granularity); !period.After(end); period = period.AddDate(0, monthStep, dayStep) {
		point := periods[period.Unix()]
		point.Time = period.Format("2006-01-02")
		result.Items = append(result.Items, point)
	}
	return result, nil
}
