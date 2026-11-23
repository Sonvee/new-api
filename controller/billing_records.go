package controller

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func parseBillingRecordTime(c *gin.Context, key string) (int64, error) {
	value := c.Query(key)
	if value == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed < 0 {
		return 0, errors.New("invalid billing record time")
	}
	return parsed, nil
}

func getBillingPageInfo(c *gin.Context) *common.PageInfo {
	pageInfo := common.GetPageQuery(c)
	if pageInfo.Page < 1 {
		pageInfo.Page = 1
	}
	if pageInfo.PageSize <= 0 {
		pageInfo.PageSize = common.ItemsPerPage
	}
	return pageInfo
}

func GetUserBillingConsumptionRecords(c *gin.Context) {
	startTime, err := parseBillingRecordTime(c, "start_time")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	endTime, err := parseBillingRecordTime(c, "end_time")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if endTime > 0 && startTime > endTime {
		common.ApiError(c, errors.New("invalid billing record time range"))
		return
	}

	pageInfo := getBillingPageInfo(c)
	items, total, err := model.GetUserBillingConsumptions(c.GetInt("id"), pageInfo, model.BillingConsumptionFilter{
		Keyword:       c.Query("keyword"),
		Type:          c.Query("type"),
		PaymentMethod: c.Query("payment_method"),
		Status:        c.Query("status"),
		StartTime:     startTime,
		EndTime:       endTime,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetUserBillingBalanceLedgers(c *gin.Context) {
	startTime, err := parseBillingRecordTime(c, "start_time")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	endTime, err := parseBillingRecordTime(c, "end_time")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if endTime > 0 && startTime > endTime {
		common.ApiError(c, errors.New("invalid billing record time range"))
		return
	}

	pageInfo := getBillingPageInfo(c)
	items, total, err := model.GetUserWalletLedgers(
		c.GetInt("id"),
		pageInfo,
		c.Query("keyword"),
		c.Query("type"),
		c.Query("direction"),
		startTime,
		endTime,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}
