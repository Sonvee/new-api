package controller

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type welfareActivityDraftRequest struct {
	TotalQuota  int   `json:"total_quota" binding:"required"`
	PacketCount int   `json:"packet_count" binding:"required"`
	MinQuota    *int  `json:"min_quota" binding:"required,gte=1"`
	StartAt     int64 `json:"start_at" binding:"required"`
}

func welfareActivityError(c *gin.Context, err error) {
	status := http.StatusInternalServerError
	code := "internal_error"
	message := "Welfare activity request failed. Please try again."
	switch {
	case errors.Is(err, model.ErrWelfareActivityInvalidConfig):
		status, code, message = http.StatusBadRequest, "invalid_configuration", "Invalid welfare activity configuration"
	case errors.Is(err, context.DeadlineExceeded):
		status, code, message = http.StatusServiceUnavailable, "busy", "Welfare activity is busy. Please try again."
	case errors.Is(err, model.ErrWelfareActivityNotFound) || errors.Is(err, gorm.ErrRecordNotFound):
		status, code, message = http.StatusNotFound, "not_found", "Welfare activity not found"
	case errors.Is(err, model.ErrWelfareActivityNotStarted):
		status, code, message = http.StatusConflict, "not_started", "Welfare activity has not started"
	case errors.Is(err, model.ErrWelfareActivityUnavailable):
		status, code, message = http.StatusConflict, "unavailable", "No welfare activity is available"
	case errors.Is(err, model.ErrWelfareActivitySoldOut):
		status, code, message = http.StatusConflict, "sold_out", "Red packets have all been claimed"
	case errors.Is(err, model.ErrWelfareActivityInvalidState):
		status, code, message = http.StatusConflict, "invalid_state", "This welfare activity cannot be changed"
	case errors.Is(err, model.ErrWelfareActivityHasScheduled):
		status, code, message = http.StatusConflict, "scheduled_exists", "A scheduled red packet issue already exists"
	case errors.Is(err, model.ErrWalletQuotaLimitExceeded):
		status, code, message = http.StatusConflict, "quota_limit", "Wallet quota limit exceeded"
	default:
		common.SysError(common.LogText("welfare activity operation failed: %s", err.Error()))
	}
	common.ApiErrorStatus(c, status, common.NewMessage(message), gin.H{"code": code})
}

func GetCurrentWelfareActivity(c *gin.Context) {
	issue, err := model.GetCurrentWelfareActivity(c.Request.Context(), c.GetInt("id"))
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, issue)
}

func ListWelfareActivityIssues(c *gin.Context) {
	pageInfo := getBillingPageInfo(c)
	items, total, err := model.ListWelfareActivityIssues(pageInfo, "", false)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	summaries := make([]*model.WelfareActivityIssueSummary, 0, len(items))
	for i := range items {
		summaries = append(summaries, model.WelfareActivityIssueToSummary(&items[i]))
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(summaries)
	common.ApiSuccess(c, pageInfo)
}

func ListWelfareActivityClaims(c *gin.Context) {
	issueNo, err := strconv.ParseInt(c.Param("issue_no"), 10, 64)
	if err != nil || issueNo <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	pageInfo := getBillingPageInfo(c)
	items, total, err := model.ListWelfareActivityClaims(issueNo, pageInfo, false)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func ClaimCurrentWelfareActivity(c *gin.Context) {
	var request struct {
		IssueNo int64 `json:"issue_no" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid request parameter format"))
		return
	}
	claim, alreadyClaimed, err := model.ClaimCurrentWelfareActivity(c.Request.Context(), c.GetInt("id"), request.IssueNo)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"claim": claim, "already_claimed": alreadyClaimed})
}

func AdminListWelfareActivityIssues(c *gin.Context) {
	pageInfo := getBillingPageInfo(c)
	items, total, err := model.ListWelfareActivityIssues(pageInfo, c.Query("status"), true)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func AdminCreateWelfareActivityDraft(c *gin.Context) {
	var request welfareActivityDraftRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		welfareActivityError(c, model.ErrWelfareActivityInvalidConfig)
		return
	}
	issue, err := model.CreateWelfareActivityDraft(c.Request.Context(), c.GetInt("id"), request.TotalQuota, request.PacketCount, *request.MinQuota, request.StartAt)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, issue)
}

func AdminUpdateWelfareActivityDraft(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	var request welfareActivityDraftRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		welfareActivityError(c, model.ErrWelfareActivityInvalidConfig)
		return
	}
	issue, err := model.UpdateWelfareActivityDraft(c.Request.Context(), id, request.TotalQuota, request.PacketCount, *request.MinQuota, request.StartAt)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, issue)
}

func AdminDeleteWelfareActivityDraft(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	if err := model.DeleteWelfareActivityDraft(c.Request.Context(), id); err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminDispatchWelfareActivityDraft(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	issue, err := model.DispatchWelfareActivityDraft(c.Request.Context(), id, c.GetInt("id"))
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, issue)
}

func AdminCancelWelfareActivityIssue(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	if err := model.CancelWelfareActivityIssue(c.Request.Context(), id, c.GetInt("id"), "cancelled by administrator"); err != nil {
		welfareActivityError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func AdminListWelfareActivityClaims(c *gin.Context) {
	issueNo, err := strconv.ParseInt(c.Param("issue_no"), 10, 64)
	if err != nil || issueNo <= 0 {
		welfareActivityError(c, model.ErrWelfareActivityNotFound)
		return
	}
	pageInfo := getBillingPageInfo(c)
	items, total, err := model.ListWelfareActivityClaims(issueNo, pageInfo, true)
	if err != nil {
		welfareActivityError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}
