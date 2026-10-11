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
package controller

import (
    "errors"
    "net/http"
    "strconv"

    "github.com/QuantumNous/new-api/common"
    "github.com/QuantumNous/new-api/model"

    "github.com/gin-gonic/gin"
)

type accountingEntryRequest struct {
    Kind          string `json:"kind"`
    PaymentMethod string `json:"payment_method"`
    Amount        string `json:"amount"`
    UserId        *int   `json:"user_id"`
    Target        string `json:"target"`
    CreateTime    int64  `json:"create_time"`
}

func getAccountingTimeFilter(c *gin.Context) (model.AccountingTimeFilter, error) {
    startTime, err := parseBillingRecordTime(c, "start_time")
    if err != nil {
        return model.AccountingTimeFilter{}, errors.New("invalid accounting start time")
    }
    endTime, err := parseBillingRecordTime(c, "end_time")
    if err != nil {
        return model.AccountingTimeFilter{}, errors.New("invalid accounting end time")
    }
    if endTime > 0 && startTime > endTime {
        return model.AccountingTimeFilter{}, errors.New("invalid accounting time range")
    }
    return model.AccountingTimeFilter{StartTime: startTime, EndTime: endTime}, nil
}

func accountingEntryFromRequest(request accountingEntryRequest) (*model.AccountingEntry, error) {
    amountCents, err := model.ParseAccountingAmount(request.Amount)
    if err != nil {
        return nil, err
    }
    return &model.AccountingEntry{
        Kind: request.Kind, PaymentMethod: request.PaymentMethod, AmountCents: amountCents,
        UserId: request.UserId, Target: request.Target, CreateTime: request.CreateTime,
    }, nil
}

func GetAccountingOnlineIncome(c *gin.Context) {
    filter, err := getAccountingTimeFilter(c)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    pageInfo := getBillingPageInfo(c)
    items, total, err := model.GetAccountingOnlineIncome(pageInfo, filter)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    pageInfo.SetTotal(int(total))
    pageInfo.SetItems(items)
    common.ApiSuccess(c, pageInfo)
}

func GetAccountingEntries(c *gin.Context) {
    filter, err := getAccountingTimeFilter(c)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    pageInfo := getBillingPageInfo(c)
    items, total, err := model.GetAccountingEntries(c.Query("kind"), pageInfo, filter)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    pageInfo.SetTotal(int(total))
    pageInfo.SetItems(items)
    common.ApiSuccess(c, pageInfo)
}

func CreateAccountingEntry(c *gin.Context) {
    var request accountingEntryRequest
    if err := c.ShouldBindJSON(&request); err != nil {
        common.ApiErrorMsg(c, "invalid accounting entry request")
        return
    }
    entry, err := accountingEntryFromRequest(request)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    record, err := model.CreateAccountingEntry(entry)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    common.ApiSuccess(c, record)
}

func UpdateAccountingEntry(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil || id <= 0 {
        common.ApiErrorMsg(c, "invalid accounting entry id")
        return
    }
    var request accountingEntryRequest
    if err := c.ShouldBindJSON(&request); err != nil {
        common.ApiErrorMsg(c, "invalid accounting entry request")
        return
    }
    entry, err := accountingEntryFromRequest(request)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    entry.Id = id
    record, err := model.UpdateAccountingEntry(entry)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    common.ApiSuccess(c, record)
}

func DeleteAccountingEntry(c *gin.Context) {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil || id <= 0 {
        common.ApiErrorMsg(c, "invalid accounting entry id")
        return
    }
    if err := model.DeleteAccountingEntry(id); err != nil {
        common.ApiError(c, err)
        return
    }
    common.ApiSuccess(c, nil)
}

func GetAccountingStats(c *gin.Context) {
    filter, err := getAccountingTimeFilter(c)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    stats, err := model.GetAccountingStats(filter)
    if err != nil {
        common.ApiError(c, err)
        return
    }
    common.ApiSuccess(c, stats)
}

func GetAccountingTrend(c *gin.Context) {
	filter, err := getAccountingTimeFilter(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	granularity := c.DefaultQuery("granularity", "day")
	trend, err := model.GetAccountingTrend(filter, granularity)
	if err != nil {
		if errors.Is(err, model.ErrInvalidAccountingGranularity) || errors.Is(err, model.ErrInvalidAccountingTime) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.SysError("failed to query accounting trend: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to query accounting trend"})
		return
	}
	common.ApiSuccess(c, trend)
}
