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
    "regexp"
    "sort"
    "strings"
    "unicode/utf8"

    "github.com/QuantumNous/new-api/common"

    "github.com/shopspring/decimal"
    "gorm.io/gorm"
)

const (
    AccountingKindOfflineIncome = "offline_income"
    AccountingKindExpense       = "expense"

    MaxAccountingAmountCents int64 = 99_999_999_999
)

var (
    ErrAccountingEntryNotFound = errors.New("accounting entry not found")
    ErrInvalidAccountingKind   = errors.New("invalid accounting entry kind")
    ErrInvalidAccountingMethod = errors.New("invalid payment method")
    ErrInvalidAccountingAmount = errors.New("amount must be greater than 0, have at most two decimal places, and not exceed 999999999.99")
    ErrInvalidAccountingUser   = errors.New("user does not exist")
    ErrInvalidAccountingTarget = errors.New("expense target is required and must not exceed 255 characters")
    ErrInvalidAccountingTime   = errors.New("invalid accounting entry time")
)

var accountingAmountPattern = regexp.MustCompile(`^\d+(\.\d{1,2})?$`)

var accountingPaymentMethods = map[string]struct{}{
    "wxpay":         {},
    "alipay":        {},
    PaymentMethodStripe:       {},
    PaymentMethodCreem:        {},
    PaymentMethodWaffo:        {},
    PaymentMethodWaffoPancake: {},
}

type AccountingEntry struct {
    Id            int    `json:"id"`
    Kind          string `json:"kind" gorm:"type:varchar(32);not null;index:idx_accounting_kind_time,priority:1"`
    PaymentMethod string `json:"payment_method" gorm:"type:varchar(50);not null"`
    AmountCents   int64  `json:"amount_cents" gorm:"type:bigint;not null"`
    UserId        *int   `json:"user_id,omitempty" gorm:"index"`
    Target        string `json:"target" gorm:"type:varchar(255);not null;default:''"`
    CreateTime    int64  `json:"create_time" gorm:"type:bigint;not null;index:idx_accounting_kind_time,priority:2"`
}

type AccountingUserSummary struct {
    Id   int    `json:"id"`
    Name string `json:"name"`
}

type AccountingOnlineIncomeRecord struct {
    Id            int                   `json:"id"`
    BillNo        string                `json:"bill_no"`
    Type          string                `json:"type"`
    PaymentMethod string                `json:"payment_method"`
    AmountCents   int64                 `json:"amount_cents"`
    User          AccountingUserSummary `json:"user"`
    CreateTime    int64                 `json:"create_time"`
}

type AccountingEntryRecord struct {
    Id            int                    `json:"id"`
    Kind          string                 `json:"kind"`
    PaymentMethod string                 `json:"payment_method"`
    AmountCents   int64                  `json:"amount_cents"`
    User          *AccountingUserSummary `json:"user,omitempty"`
    Target        string                 `json:"target"`
    CreateTime    int64                  `json:"create_time"`
}

type AccountingTimeFilter struct {
    StartTime int64
    EndTime   int64
}

type AccountingStats struct {
    OnlineIncomeCents  int64 `json:"online_income_cents"`
    OfflineIncomeCents int64 `json:"offline_income_cents"`
    TotalIncomeCents   int64 `json:"total_income_cents"`
    TotalExpenseCents  int64 `json:"total_expense_cents"`
    GrossProfitCents   int64 `json:"gross_profit_cents"`
}

type accountingOnlineCandidate struct {
    Id            int
    UserId        int
    BillNo        string
    Type          string
    PaymentMethod string
    Money         float64
    CreateTime    int64
}

func ParseAccountingAmount(value string) (int64, error) {
    value = strings.TrimSpace(value)
    if !accountingAmountPattern.MatchString(value) {
        return 0, ErrInvalidAccountingAmount
    }
    amount, err := decimal.NewFromString(value)
    if err != nil || amount.LessThanOrEqual(decimal.Zero) {
        return 0, ErrInvalidAccountingAmount
    }
    cents := amount.Mul(decimal.NewFromInt(100))
    if !cents.Equal(cents.Truncate(0)) || cents.GreaterThan(decimal.NewFromInt(MaxAccountingAmountCents)) {
        return 0, ErrInvalidAccountingAmount
    }
    return cents.IntPart(), nil
}

func validateAccountingEntry(entry *AccountingEntry) error {
    entry.PaymentMethod = strings.TrimSpace(entry.PaymentMethod)
    if entry.Kind != AccountingKindOfflineIncome && entry.Kind != AccountingKindExpense {
        return ErrInvalidAccountingKind
    }
    if _, ok := accountingPaymentMethods[entry.PaymentMethod]; !ok {
        return ErrInvalidAccountingMethod
    }
    if entry.AmountCents <= 0 || entry.AmountCents > MaxAccountingAmountCents {
        return ErrInvalidAccountingAmount
    }
    if entry.CreateTime <= 0 {
        return ErrInvalidAccountingTime
    }

    entry.Target = strings.TrimSpace(entry.Target)
    if entry.Kind == AccountingKindOfflineIncome {
        if entry.UserId == nil || *entry.UserId <= 0 {
            return ErrInvalidAccountingUser
        }
        var count int64
        if err := DB.Model(&User{}).Where("id = ?", *entry.UserId).Count(&count).Error; err != nil {
            return err
        }
        if count != 1 {
            return ErrInvalidAccountingUser
        }
        entry.Target = ""
        return nil
    }

    entry.UserId = nil
    if entry.Target == "" || utf8.RuneCountInString(entry.Target) > 255 {
        return ErrInvalidAccountingTarget
    }
    return nil
}

func applyAccountingTimeFilter(query *gorm.DB, column string, filter AccountingTimeFilter) *gorm.DB {
    if filter.StartTime > 0 {
        query = query.Where(column+" >= ?", filter.StartTime)
    }
    if filter.EndTime > 0 {
        query = query.Where(column+" <= ?", filter.EndTime)
    }
    return query
}

func accountingUserName(user User) string {
    if displayName := strings.TrimSpace(user.DisplayName); displayName != "" {
        return displayName
    }
    return user.Username
}

func getAccountingUsers(userIds []int) (map[int]AccountingUserSummary, error) {
    if len(userIds) == 0 {
        return map[int]AccountingUserSummary{}, nil
    }
    uniqueIds := make(map[int]struct{}, len(userIds))
    for _, userId := range userIds {
        if userId > 0 {
            uniqueIds[userId] = struct{}{}
        }
    }
    ids := make([]int, 0, len(uniqueIds))
    for userId := range uniqueIds {
        ids = append(ids, userId)
    }
    var users []User
    if err := DB.Unscoped().Select("id", "username", "display_name").Where("id IN ?", ids).Find(&users).Error; err != nil {
        return nil, err
    }
    result := make(map[int]AccountingUserSummary, len(users))
    for _, user := range users {
        result[user.Id] = AccountingUserSummary{Id: user.Id, Name: accountingUserName(user)}
    }
    return result, nil
}

func accountingMoneyToCents(value float64) int64 {
    return decimal.NewFromFloat(value).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

// 两类线上收入在列表、汇总和趋势中必须采用同一过滤口径。
func accountingTopUpIncomeQuery(filter AccountingTimeFilter) *gorm.DB {
    query := DB.Model(&TopUp{}).
        Where("status = ? AND amount > 0", common.TopUpStatusSuccess).
        Where("NOT EXISTS (SELECT 1 FROM wallet_ledgers WHERE wallet_ledgers.user_id = top_ups.user_id AND wallet_ledgers.source_type = ? AND wallet_ledgers.source_id = top_ups.trade_no AND wallet_ledgers.type = ?)", "topup", WalletLedgerTypeAdminTopup)
    return applyAccountingTimeFilter(query, "create_time", filter)
}

func accountingSubscriptionIncomeQuery(filter AccountingTimeFilter) *gorm.DB {
    query := DB.Model(&SubscriptionOrder{}).
        Where("status = ? AND money > 0", common.TopUpStatusSuccess).
        Where("payment_provider <> ? AND payment_method <> ?", PaymentProviderBalance, PaymentMethodBalance)
    return applyAccountingTimeFilter(query, "create_time", filter)
}

func GetAccountingOnlineIncome(pageInfo *common.PageInfo, filter AccountingTimeFilter) ([]*AccountingOnlineIncomeRecord, int64, error) {
    topupQuery := accountingTopUpIncomeQuery(filter)

    subscriptionQuery := accountingSubscriptionIncomeQuery(filter)

    var topupTotal int64
    if err := topupQuery.Count(&topupTotal).Error; err != nil {
        return nil, 0, err
    }
    var subscriptionTotal int64
    if err := subscriptionQuery.Count(&subscriptionTotal).Error; err != nil {
        return nil, 0, err
    }

    limit := pageInfo.GetStartIdx() + pageInfo.GetPageSize()
    if limit < pageInfo.GetPageSize() {
        limit = pageInfo.GetPageSize()
    }
    var topups []TopUp
    if err := topupQuery.Select("id", "user_id", "money", "trade_no", "payment_method", "create_time").Order("create_time desc, id desc").Limit(limit).Find(&topups).Error; err != nil {
        return nil, 0, err
    }
    var subscriptions []SubscriptionOrder
    if err := subscriptionQuery.Select("id", "user_id", "money", "trade_no", "payment_method", "create_time").Order("create_time desc, id desc").Limit(limit).Find(&subscriptions).Error; err != nil {
        return nil, 0, err
    }

    candidates := make([]accountingOnlineCandidate, 0, len(topups)+len(subscriptions))
    userIds := make([]int, 0, len(topups)+len(subscriptions))
    for _, topup := range topups {
        candidates = append(candidates, accountingOnlineCandidate{Id: topup.Id, UserId: topup.UserId, BillNo: topup.TradeNo, Type: "topup", PaymentMethod: topup.PaymentMethod, Money: topup.Money, CreateTime: topup.CreateTime})
        userIds = append(userIds, topup.UserId)
    }
    for _, order := range subscriptions {
        candidates = append(candidates, accountingOnlineCandidate{Id: order.Id, UserId: order.UserId, BillNo: order.TradeNo, Type: "subscription", PaymentMethod: order.PaymentMethod, Money: order.Money, CreateTime: order.CreateTime})
        userIds = append(userIds, order.UserId)
    }
    sort.SliceStable(candidates, func(i, j int) bool {
        if candidates[i].CreateTime != candidates[j].CreateTime {
            return candidates[i].CreateTime > candidates[j].CreateTime
        }
        if candidates[i].Id != candidates[j].Id {
            return candidates[i].Id > candidates[j].Id
        }
        return candidates[i].Type < candidates[j].Type
    })

    users, err := getAccountingUsers(userIds)
    if err != nil {
        return nil, 0, err
    }
    start := min(pageInfo.GetStartIdx(), len(candidates))
    end := min(start+pageInfo.GetPageSize(), len(candidates))
    records := make([]*AccountingOnlineIncomeRecord, 0, end-start)
    for _, candidate := range candidates[start:end] {
        user := users[candidate.UserId]
        if user.Id == 0 {
            user.Id = candidate.UserId
        }
        records = append(records, &AccountingOnlineIncomeRecord{
            Id: candidate.Id, BillNo: candidate.BillNo, Type: candidate.Type, PaymentMethod: candidate.PaymentMethod,
            AmountCents: accountingMoneyToCents(candidate.Money), User: user, CreateTime: candidate.CreateTime,
        })
    }
    return records, topupTotal + subscriptionTotal, nil
}

func GetAccountingEntries(kind string, pageInfo *common.PageInfo, filter AccountingTimeFilter) ([]*AccountingEntryRecord, int64, error) {
    if kind != AccountingKindOfflineIncome && kind != AccountingKindExpense {
        return nil, 0, ErrInvalidAccountingKind
    }
    query := applyAccountingTimeFilter(DB.Model(&AccountingEntry{}).Where("kind = ?", kind), "create_time", filter)
    var total int64
    if err := query.Count(&total).Error; err != nil {
        return nil, 0, err
    }
    var entries []AccountingEntry
    if err := query.Order("create_time desc, id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&entries).Error; err != nil {
        return nil, 0, err
    }

    userIds := make([]int, 0, len(entries))
    for _, entry := range entries {
        if entry.UserId != nil {
            userIds = append(userIds, *entry.UserId)
        }
    }
    users, err := getAccountingUsers(userIds)
    if err != nil {
        return nil, 0, err
    }
    records := make([]*AccountingEntryRecord, 0, len(entries))
    for _, entry := range entries {
        record := &AccountingEntryRecord{Id: entry.Id, Kind: entry.Kind, PaymentMethod: entry.PaymentMethod, AmountCents: entry.AmountCents, Target: entry.Target, CreateTime: entry.CreateTime}
        if entry.UserId != nil {
            user := users[*entry.UserId]
            if user.Id == 0 {
                user.Id = *entry.UserId
            }
            record.User = &user
        }
        records = append(records, record)
    }
    return records, total, nil
}

func CreateAccountingEntry(entry *AccountingEntry) (*AccountingEntryRecord, error) {
    if err := validateAccountingEntry(entry); err != nil {
        return nil, err
    }
    if err := DB.Create(entry).Error; err != nil {
        return nil, err
    }
    records, _, err := GetAccountingEntriesByIds([]int{entry.Id})
    if err != nil {
        return nil, err
    }
    if len(records) == 0 {
        return nil, ErrAccountingEntryNotFound
    }
    return records[0], nil
}

func UpdateAccountingEntry(entry *AccountingEntry) (*AccountingEntryRecord, error) {
    var existing AccountingEntry
    if err := DB.First(&existing, entry.Id).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, ErrAccountingEntryNotFound
        }
        return nil, err
    }
    if entry.Kind != existing.Kind {
        return nil, ErrInvalidAccountingKind
    }
    if err := validateAccountingEntry(entry); err != nil {
        return nil, err
    }
    result := DB.Model(&AccountingEntry{}).Where("id = ?", entry.Id).Updates(map[string]any{
        "payment_method": entry.PaymentMethod,
        "amount_cents": entry.AmountCents,
        "user_id": entry.UserId,
        "target": entry.Target,
        "create_time": entry.CreateTime,
    })
    if result.Error != nil {
        return nil, result.Error
    }
    records, _, err := GetAccountingEntriesByIds([]int{entry.Id})
    if err != nil {
        return nil, err
    }
    if len(records) == 0 {
        return nil, ErrAccountingEntryNotFound
    }
    return records[0], nil
}

func GetAccountingEntriesByIds(ids []int) ([]*AccountingEntryRecord, int64, error) {
    if len(ids) == 0 {
        return []*AccountingEntryRecord{}, 0, nil
    }
    var entries []AccountingEntry
    if err := DB.Where("id IN ?", ids).Find(&entries).Error; err != nil {
        return nil, 0, err
    }
    userIds := make([]int, 0, len(entries))
    for _, entry := range entries {
        if entry.UserId != nil {
            userIds = append(userIds, *entry.UserId)
        }
    }
    users, err := getAccountingUsers(userIds)
    if err != nil {
        return nil, 0, err
    }
    records := make([]*AccountingEntryRecord, 0, len(entries))
    for _, entry := range entries {
        record := &AccountingEntryRecord{Id: entry.Id, Kind: entry.Kind, PaymentMethod: entry.PaymentMethod, AmountCents: entry.AmountCents, Target: entry.Target, CreateTime: entry.CreateTime}
        if entry.UserId != nil {
            user := users[*entry.UserId]
            if user.Id == 0 {
                user.Id = *entry.UserId
            }
            record.User = &user
        }
        records = append(records, record)
    }
    return records, int64(len(records)), nil
}

func DeleteAccountingEntry(id int) error {
    result := DB.Delete(&AccountingEntry{}, id)
    if result.Error != nil {
        return result.Error
    }
    if result.RowsAffected != 1 {
        return ErrAccountingEntryNotFound
    }
    return nil
}

func GetAccountingStats(filter AccountingTimeFilter) (AccountingStats, error) {
    var topupMoney []float64
    topupQuery := accountingTopUpIncomeQuery(filter)
    if err := topupQuery.Pluck("money", &topupMoney).Error; err != nil {
        return AccountingStats{}, err
    }

    var subscriptionMoney []float64
    subscriptionQuery := accountingSubscriptionIncomeQuery(filter)
    if err := subscriptionQuery.Pluck("money", &subscriptionMoney).Error; err != nil {
        return AccountingStats{}, err
    }

    stats := AccountingStats{}
    for _, money := range topupMoney {
        stats.OnlineIncomeCents += accountingMoneyToCents(money)
    }
    for _, money := range subscriptionMoney {
        stats.OnlineIncomeCents += accountingMoneyToCents(money)
    }

    type entrySum struct {
        Kind        string
        AmountCents int64
    }
    var sums []entrySum
    entryQuery := applyAccountingTimeFilter(DB.Model(&AccountingEntry{}), "create_time", filter)
    if err := entryQuery.Select("kind, COALESCE(SUM(amount_cents), 0) AS amount_cents").Group("kind").Scan(&sums).Error; err != nil {
        return AccountingStats{}, err
    }
    for _, sum := range sums {
        switch sum.Kind {
        case AccountingKindOfflineIncome:
            stats.OfflineIncomeCents = sum.AmountCents
        case AccountingKindExpense:
            stats.TotalExpenseCents = sum.AmountCents
        }
    }
    stats.TotalIncomeCents = stats.OnlineIncomeCents + stats.OfflineIncomeCents
    stats.GrossProfitCents = stats.TotalIncomeCents - stats.TotalExpenseCents
    return stats, nil
}
