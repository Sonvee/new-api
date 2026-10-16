package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

const (
	WelfareActivityTypeRedPacket         = "red_packet"
	WelfareActivityStatusDraft           = "draft"
	WelfareActivityStatusScheduled       = "scheduled"
	WelfareActivityStatusActive          = "active"
	WelfareActivityStatusFinished        = "finished"
	WelfareActivityStatusLegacyCancelled = "cancelled"
	// 限制分发事务的规模，避免管理员配置占用过多内存或长期锁库。
	MaxWelfarePacketCount = 10000
)

var (
	ErrWelfareActivityNotFound      = errors.New("welfare activity not found")
	ErrWelfareActivityInvalidConfig = errors.New("invalid welfare activity configuration")
	ErrWelfareActivityInvalidState  = errors.New("welfare activity is not in an editable state")
	ErrWelfareActivityNotStarted    = errors.New("welfare activity has not started")
	ErrWelfareActivityUnavailable   = errors.New("welfare activity is unavailable")
	ErrWelfareActivitySoldOut       = errors.New("welfare activity is sold out")
	ErrWelfareActivityHasScheduled  = errors.New("another scheduled welfare activity already exists")
)

type WelfareActivityIssue struct {
	Id int `json:"id" gorm:"primaryKey"`
	// 草稿使用 NULL 而不是 0，允许三个数据库保存多个无期数草稿。
	IssueNo      *int64 `json:"issue_no" gorm:"uniqueIndex"`
	ActivityType string `json:"activity_type" gorm:"type:varchar(32);not null"`
	Status       string `json:"status" gorm:"type:varchar(32);index:idx_welfare_status_start,priority:1;not null"`
	TotalQuota   int    `json:"total_quota" gorm:"type:bigint;not null"`
	PacketCount  int    `json:"packet_count" gorm:"not null"`
	MinQuota     int    `json:"min_quota" gorm:"type:bigint;not null"`
	// 保留旧列以兼容已存在的数据库结构；红包算法不再使用单份最大额度。
	MaxQuota       int    `json:"-" gorm:"type:bigint;not null"`
	RemainingQuota int    `json:"remaining_quota" gorm:"type:bigint;not null"`
	RemainingCount int    `json:"remaining_count" gorm:"not null"`
	StartAt        int64  `json:"start_at" gorm:"type:bigint;index:idx_welfare_status_start,priority:2;not null"`
	CreatedBy      int    `json:"created_by,omitempty"`
	DispatchedBy   int    `json:"dispatched_by,omitempty"`
	CancelledBy    int    `json:"cancelled_by,omitempty"`
	CancelReason   string `json:"cancel_reason,omitempty" gorm:"type:varchar(255)"`
	CreatedAt      int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"type:bigint"`
	DispatchedAt   int64  `json:"dispatched_at" gorm:"type:bigint"`
	FinishedAt     int64  `json:"finished_at" gorm:"type:bigint"`
	CancelledAt    int64  `json:"cancelled_at" gorm:"type:bigint"`
}

func (WelfareActivityIssue) TableName() string { return "welfare_activity_issues" }

func normalizedWelfareActivityStatus(status string) string {
	if status == WelfareActivityStatusLegacyCancelled {
		return WelfareActivityStatusFinished
	}
	return status
}

// 福利活动共用协调行；期号分配、激活、编辑、取消和领取都先获取这行的写锁。
// SQLite 先 UPDATE 再读，避免 DEFERRED 事务从读锁升级导致双写或快照冲突。
type WelfareActivityIssueCounter struct {
	Id          int   `gorm:"primaryKey"`
	NextIssueNo int64 `gorm:"type:bigint;not null"`
	Version     int64 `gorm:"type:bigint;not null"`
}

func (WelfareActivityIssueCounter) TableName() string { return "welfare_activity_issue_counters" }

type WelfareActivityRedPacket struct {
	Id          int  `gorm:"primaryKey"`
	IssueId     int  `gorm:"uniqueIndex:idx_welfare_packet_issue_index,priority:1"`
	PacketIndex int  `gorm:"uniqueIndex:idx_welfare_packet_issue_index,priority:2"`
	Quota       int  `gorm:"type:bigint;not null"`
	ClaimId     *int `gorm:"uniqueIndex"`
}

func (WelfareActivityRedPacket) TableName() string { return "welfare_activity_red_packets" }

type WelfareActivityClaim struct {
	Id             int    `gorm:"primaryKey"`
	IssueId        int    `gorm:"uniqueIndex:idx_welfare_claim_issue_user,priority:1;index:idx_welfare_claim_time,priority:1"`
	PacketId       int    `gorm:"uniqueIndex"`
	UserId         int    `gorm:"uniqueIndex:idx_welfare_claim_issue_user,priority:2"`
	Quota          int    `gorm:"type:bigint;not null"`
	IdempotencyKey string `gorm:"uniqueIndex;type:varchar(255)"`
	LedgerNo       string `gorm:"type:varchar(64)"`
	CreatedAt      int64  `gorm:"type:bigint;index:idx_welfare_claim_time,priority:2"`
}

func (WelfareActivityClaim) TableName() string { return "welfare_activity_claims" }

// 用户接口不复用管理员实体，避免泄露操作人、来源和未来扩展的敏感字段。
type WelfareActivityIssueSummary struct {
	Id             int                       `json:"id"`
	IssueNo        int64                     `json:"issue_no"`
	Status         string                    `json:"status"`
	TotalQuota     int                       `json:"total_quota"`
	PacketCount    int                       `json:"packet_count"`
	RemainingQuota int                       `json:"remaining_quota"`
	RemainingCount int                       `json:"remaining_count"`
	StartAt        int64                     `json:"start_at"`
	Claim          *WelfareActivityClaimView `json:"claim,omitempty"`
}

type WelfareActivityCurrent struct {
	ServerTime int64                        `json:"server_time"`
	Issue      *WelfareActivityIssueSummary `json:"issue"`
	Upcoming   *WelfareActivityIssueSummary `json:"upcoming"`
}

type WelfareActivityClaimView struct {
	Id        int    `json:"id"`
	IssueNo   int64  `json:"issue_no"`
	UserId    int    `json:"user_id,omitempty"`
	Username  string `json:"username"`
	Quota     int    `json:"quota"`
	CreatedAt int64  `json:"created_at"`
	LedgerNo  string `json:"ledger_no,omitempty"`
}

func WelfareActivityIssueToSummary(issue *WelfareActivityIssue) *WelfareActivityIssueSummary {
	if issue == nil {
		return nil
	}
	result := &WelfareActivityIssueSummary{
		Id: issue.Id, Status: normalizedWelfareActivityStatus(issue.Status), TotalQuota: issue.TotalQuota,
		PacketCount: issue.PacketCount, RemainingQuota: issue.RemainingQuota,
		RemainingCount: issue.RemainingCount, StartAt: issue.StartAt,
	}
	if issue.IssueNo != nil {
		result.IssueNo = *issue.IssueNo
	}
	return result
}

func ValidateWelfareActivityConfig(totalQuota, packetCount, minQuota int, startAt int64) error {
	if totalQuota <= 0 || totalQuota > common.MaxWalletQuota || packetCount <= 0 || packetCount > MaxWelfarePacketCount || minQuota < 1 || startAt <= 0 || startAt > 253402271999 {
		return ErrWelfareActivityInvalidConfig
	}
	// 每份红包至少分配一个内部 quota 单位，且配置的最小额度也必须从一个单位开始。
	if totalQuota < packetCount || minQuota > totalQuota/packetCount {
		return ErrWelfareActivityInvalidConfig
	}
	return nil
}
