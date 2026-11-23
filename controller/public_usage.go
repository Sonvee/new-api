package controller

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const publicUsageDateFormat = "2006-01-02"

type publicTokenUsageResponse struct {
	EndDate     string `json:"end_date"`
	StartDate   string `json:"start_date"`
	TotalTokens int64  `json:"total_tokens"`
}

func GetPublicTokenUsage(c *gin.Context) {
	startDateText := c.Query("start_date")
	endDateText := c.Query("end_date")
	if startDateText == "" || endDateText == "" {
		common.ApiError(c, errors.New("start_date and end_date are required"))
		return
	}

	startDate, err := parsePublicUsageDate(startDateText)
	if err != nil {
		common.ApiError(c, errors.New("invalid date format, expected YYYY-MM-DD"))
		return
	}
	endDate, err := parsePublicUsageDate(endDateText)
	if err != nil {
		common.ApiError(c, errors.New("invalid date format, expected YYYY-MM-DD"))
		return
	}

	today := time.Now().In(time.Local)
	today = time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.Local)
	if startDate.After(endDate) {
		common.ApiError(c, errors.New("invalid date range"))
		return
	}
	if endDate.After(startDate.AddDate(0, 0, 364)) {
		common.ApiError(c, errors.New("date range cannot exceed 365 days"))
		return
	}
	if startDate.After(today) || endDate.After(today) {
		common.ApiError(c, errors.New("future dates are not allowed"))
		return
	}

	totalTokens, err := model.GetTotalQuotaDataTokens(startDate.Unix(), endDate.AddDate(0, 0, 1).Unix())
	if err != nil {
		common.SysError("failed to query public token usage: " + err.Error())
		common.ApiError(c, errors.New("failed to query public token usage"))
		return
	}

	common.ApiSuccess(c, publicTokenUsageResponse{
		EndDate:     endDateText,
		StartDate:   startDateText,
		TotalTokens: totalTokens,
	})
}

func parsePublicUsageDate(value string) (time.Time, error) {
	parsed, err := time.ParseInLocation(publicUsageDateFormat, value, time.Local)
	if err != nil || parsed.Format(publicUsageDateFormat) != value {
		return time.Time{}, errors.New("invalid date")
	}
	return parsed, nil
}
