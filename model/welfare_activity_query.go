package model

import (
	"context"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func HasDueWelfareActivity() bool {
	var count int64
	return DB.Model(&WelfareActivityIssue{}).Where("status = ? AND start_at <= ?", WelfareActivityStatusScheduled, common.GetTimestamp()).Count(&count).Error == nil && count > 0
}

func GetCurrentWelfareActivity(ctx context.Context, userId int) (*WelfareActivityCurrent, error) {
	if _, err := ActivateDueWelfareActivity(ctx); err != nil {
		return nil, err
	}
	var issues []WelfareActivityIssue
	if err := DB.WithContext(ctx).Where("status IN ?", []string{WelfareActivityStatusActive, WelfareActivityStatusScheduled}).Order("issue_no desc").Find(&issues).Error; err != nil {
		return nil, err
	}
	result := &WelfareActivityCurrent{ServerTime: common.GetTimestamp()}
	for _, issue := range issues {
		summary := WelfareActivityIssueToSummary(&issue)
		var claim WelfareActivityClaim
		err := DB.WithContext(ctx).Where("issue_id = ? AND user_id = ?", issue.Id, userId).First(&claim).Error
		if err == nil {
			summary.Claim = &WelfareActivityClaimView{Id: claim.Id, IssueNo: summary.IssueNo, Quota: claim.Quota, CreatedAt: claim.CreatedAt}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if issue.Status == WelfareActivityStatusActive {
			result.Issue = summary
		} else {
			result.Upcoming = summary
		}
	}
	if result.Issue == nil {
		result.Issue, result.Upcoming = result.Upcoming, nil
	}
	if result.Issue != nil {
		return result, nil
	}

	// 当最后一期红包已被领完且没有新的预约期时，继续展示这期已结束的红包，
	// 让用户可以看到最终状态和自己的领取结果，而不是回退到空状态。
	var finished WelfareActivityIssue
	if err := DB.WithContext(ctx).
		Where("status IN ?", []string{WelfareActivityStatusFinished, WelfareActivityStatusLegacyCancelled}).
		Order("issue_no desc").
		First(&finished).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return result, nil
		}
		return nil, err
	}
	finishedSummary := WelfareActivityIssueToSummary(&finished)
	var claim WelfareActivityClaim
	err := DB.WithContext(ctx).
		Where("issue_id = ? AND user_id = ?", finished.Id, userId).
		First(&claim).Error
	if err == nil {
		finishedSummary.Claim = &WelfareActivityClaimView{
			Id: claim.Id, IssueNo: finishedSummary.IssueNo, Quota: claim.Quota, CreatedAt: claim.CreatedAt,
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	result.Issue = finishedSummary
	return result, nil
}

func ListWelfareActivityIssues(pageInfo *common.PageInfo, status string, includeDraft bool) ([]WelfareActivityIssue, int64, error) {
	query := DB.Model(&WelfareActivityIssue{})
	if !includeDraft {
		query = query.Where("issue_no IS NOT NULL")
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	issues := make([]WelfareActivityIssue, 0)
	order := "issue_no desc"
	// 后台包含 NULL 草稿，按创建 id 排序；前台按正式期号排序。
	if includeDraft {
		order = "id desc"
	}
	err := query.Order(order).Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&issues).Error
	for index := range issues {
		issues[index].Status = normalizedWelfareActivityStatus(issues[index].Status)
	}
	return issues, total, err
}

func GetWelfareActivityIssueByIssueNo(issueNo int64) (*WelfareActivityIssue, error) {
	if issueNo <= 0 {
		return nil, ErrWelfareActivityNotFound
	}
	var issue WelfareActivityIssue
	if err := DB.Where("issue_no = ?", issueNo).First(&issue).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrWelfareActivityNotFound
		}
		return nil, err
	}
	return &issue, nil
}

func maskWelfareActivityUsername(username string) string {
	runes := []rune(strings.TrimSpace(username))
	if len(runes) <= 1 {
		return "*"
	}
	if len(runes) == 2 {
		return string(runes[0]) + "*"
	}
	return string(runes[0]) + strings.Repeat("*", min(3, len(runes)-2)) + string(runes[len(runes)-1])
}

func ListWelfareActivityClaims(issueNo int64, pageInfo *common.PageInfo, admin bool) ([]WelfareActivityClaimView, int64, error) {
	issue, err := GetWelfareActivityIssueByIssueNo(issueNo)
	if err != nil {
		return nil, 0, err
	}
	query := DB.Model(&WelfareActivityClaim{}).Where("issue_id = ?", issue.Id)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	claims := make([]WelfareActivityClaim, 0)
	if err := query.Order("created_at desc, id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&claims).Error; err != nil {
		return nil, 0, err
	}
	// 单页批量查用户，避免每条记录额外查询或向普通用户序列化完整用户。
	userIds := make([]int, 0, len(claims))
	for _, claim := range claims {
		userIds = append(userIds, claim.UserId)
	}
	var users []User
	if len(userIds) > 0 {
		if err := DB.Unscoped().Select("id", "username").Where("id IN ?", userIds).Find(&users).Error; err != nil {
			return nil, 0, err
		}
	}
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
	}
	result := make([]WelfareActivityClaimView, 0, len(claims))
	for _, claim := range claims {
		item := WelfareActivityClaimView{Id: claim.Id, IssueNo: issueNo, Username: usernames[claim.UserId], Quota: claim.Quota, CreatedAt: claim.CreatedAt}
		if admin {
			item.UserId, item.LedgerNo = claim.UserId, claim.LedgerNo
		} else {
			item.Username = maskWelfareActivityUsername(item.Username)
		}
		result = append(result, item)
	}
	return result, total, nil
}
