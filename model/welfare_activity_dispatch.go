package model

import (
	"context"
	cryptorand "crypto/rand"
	"errors"
	"math/big"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func InitializeWelfareActivityIssueCounter() error {
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&WelfareActivityIssueCounter{Id: 1, NextIssueNo: 1}).Error
}

// 同一固定协调行也保护“尚无活动”的场景，不能只锁查到的 active 行。
// UPDATE 必须是事务第一个数据库操作：SQLite 也会在任何读取前持有写锁。
func lockWelfareActivityTx(tx *gorm.DB) error {
	result := tx.Model(&WelfareActivityIssueCounter{}).Where("id = ?", 1).Update("version", gorm.Expr("version + 1"))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("welfare activity coordinator is missing")
	}
	return nil
}

func CreateWelfareActivityDraft(ctx context.Context, createdBy, totalQuota, packetCount, minQuota int, startAt int64) (*WelfareActivityIssue, error) {
	if err := ValidateWelfareActivityConfig(totalQuota, packetCount, minQuota, startAt); err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	issue := &WelfareActivityIssue{ActivityType: WelfareActivityTypeRedPacket, Status: WelfareActivityStatusDraft, TotalQuota: totalQuota, PacketCount: packetCount, MinQuota: minQuota, StartAt: startAt, CreatedBy: createdBy, CreatedAt: now, UpdatedAt: now}
	return issue, DB.WithContext(ctx).Create(issue).Error
}

func UpdateWelfareActivityDraft(ctx context.Context, id, totalQuota, packetCount, minQuota int, startAt int64) (*WelfareActivityIssue, error) {
	if err := ValidateWelfareActivityConfig(totalQuota, packetCount, minQuota, startAt); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var issue WelfareActivityIssue
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		if err := lockForUpdate(tx).First(&issue, id).Error; err != nil {
			return err
		}
		if issue.Status != WelfareActivityStatusDraft {
			return ErrWelfareActivityInvalidState
		}
		issue.TotalQuota, issue.PacketCount, issue.MinQuota, issue.StartAt = totalQuota, packetCount, minQuota, startAt
		issue.UpdatedAt = common.GetTimestamp()
		return tx.Save(&issue).Error
	})
	return &issue, err
}

func DeleteWelfareActivityDraft(ctx context.Context, id int) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		var issue WelfareActivityIssue
		if err := lockForUpdate(tx).First(&issue, id).Error; err != nil {
			return err
		}
		if issue.Status != WelfareActivityStatusDraft && issue.Status != WelfareActivityStatusScheduled {
			return ErrWelfareActivityInvalidState
		}
		if issue.Status == WelfareActivityStatusScheduled {
			if issue.IssueNo == nil {
				return ErrWelfareActivityInvalidState
			}
			var counter WelfareActivityIssueCounter
			if err := lockForUpdate(tx).First(&counter, 1).Error; err != nil {
				return err
			}
			if counter.NextIssueNo != *issue.IssueNo+1 {
				return ErrWelfareActivityInvalidState
			}
			if err := tx.Model(&counter).Update("next_issue_no", *issue.IssueNo).Error; err != nil {
				return err
			}
			if err := tx.Where("issue_id = ?", issue.Id).Delete(&WelfareActivityRedPacket{}).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&issue).Error
	})
}

func randomIntInclusive(maximum int64) (int64, error) {
	if maximum == 0 {
		return 0, nil
	}
	value, err := cryptorand.Int(cryptorand.Reader, big.NewInt(maximum+1))
	if err != nil {
		return 0, err
	}
	return value.Int64(), nil
}

// 先分配每份保底，再使用随机切分点将剩余额度均匀拆分；总和精确且无浮点计算。
func generateWelfareActivityQuotas(totalQuota, packetCount, minQuota int) ([]int, error) {
	if err := ValidateWelfareActivityConfig(totalQuota, packetCount, minQuota, 1); err != nil {
		return nil, err
	}
	minimum := int64(minQuota)
	extra := int64(totalQuota) - int64(packetCount)*minimum
	quotas := make([]int, packetCount)
	for index := range quotas {
		quotas[index] = int(minimum)
	}

	// 随机选择 N-1 个切分点，等价于从所有整数拆分中均匀选择一种，
	// 避免按红包顺序逐个随机造成前后位置的概率偏差。
	barCount := packetCount - 1
	barLimit := extra + int64(packetCount) - 1
	barPositions := make([]int64, barCount)
	selected := make(map[int64]struct{}, barCount)
	firstIndex := barLimit - int64(barCount)
	for index, candidateIndex := 0, firstIndex; candidateIndex < barLimit; index, candidateIndex = index+1, candidateIndex+1 {
		candidate, err := randomIntInclusive(candidateIndex)
		if err != nil {
			return nil, err
		}
		position := candidate
		if _, exists := selected[candidate]; exists {
			position = candidateIndex
		}
		selected[position] = struct{}{}
		barPositions[index] = position + 1
	}
	slices.Sort(barPositions)

	previous := int64(0)
	for index, position := range barPositions {
		quotas[index] += int(position - previous - 1)
		previous = position
	}
	quotas[packetCount-1] += int(barLimit - previous)

	// 在落库前再次守住精确总额和单份边界，不把算法正确性当成唯一防线。
	sum := 0
	for _, quota := range quotas {
		if quota < int(minimum) || quota > totalQuota-sum {
			return nil, errors.New("generated welfare packet quota invariant violated")
		}
		sum += quota
	}
	if sum != totalQuota {
		return nil, errors.New("generated welfare total quota invariant violated")
	}
	return quotas, nil
}

func finishActiveWelfareActivityTx(tx *gorm.DB, now int64, actorId int, reason string) error {
	// 保留原有库存用于审计；结束状态即可阻止领取，避免切期时大量更新红包行。
	return tx.Model(&WelfareActivityIssue{}).Where("status = ?", WelfareActivityStatusActive).Updates(map[string]any{
		"status": WelfareActivityStatusFinished, "cancelled_by": actorId,
		"cancel_reason": reason, "cancelled_at": now, "finished_at": now, "updated_at": now,
	}).Error
}

func DispatchWelfareActivityDraft(ctx context.Context, id, actorId int) (*WelfareActivityIssue, error) {
	var issue WelfareActivityIssue
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	// 预生成不占协调锁；入事务后核对草稿未变，避免开抢事务等待随机计算。
	var snapshot WelfareActivityIssue
	if err := DB.WithContext(ctx).First(&snapshot, id).Error; err != nil {
		return nil, err
	}
	if snapshot.IssueNo != nil {
		return &snapshot, nil
	}
	quotas, err := generateWelfareActivityQuotas(snapshot.TotalQuota, snapshot.PacketCount, snapshot.MinQuota)
	if err != nil {
		return nil, err
	}
	err = DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		if err := lockForUpdate(tx).First(&issue, id).Error; err != nil {
			return err
		}
		// 原草稿的重复分发返回同一期，不重新编号或重新生成金额。
		if issue.IssueNo != nil {
			return nil
		}
		if issue.Status != WelfareActivityStatusDraft {
			return ErrWelfareActivityInvalidState
		}
		if issue.TotalQuota != snapshot.TotalQuota || issue.PacketCount != snapshot.PacketCount || issue.MinQuota != snapshot.MinQuota || issue.StartAt != snapshot.StartAt {
			return ErrWelfareActivityInvalidState
		}
		if err := ValidateWelfareActivityConfig(issue.TotalQuota, issue.PacketCount, issue.MinQuota, issue.StartAt); err != nil {
			return err
		}
		now := common.GetTimestamp()
		if _, err := activateDueWelfareActivityTx(tx, now); err != nil {
			return err
		}
		var scheduledCount int64
		if err := tx.Model(&WelfareActivityIssue{}).Where("status = ?", WelfareActivityStatusScheduled).Count(&scheduledCount).Error; err != nil {
			return err
		}
		// 先废弃待开抢期再新建，避免旧的预约期反过来替换期号更新的立即活动。
		if scheduledCount > 0 {
			return ErrWelfareActivityHasScheduled
		}
		var counter WelfareActivityIssueCounter
		if err := lockForUpdate(tx).First(&counter, 1).Error; err != nil {
			return err
		}
		if counter.NextIssueNo <= 0 || counter.NextIssueNo >= common.MaxWalletQuota {
			return ErrWelfareActivityInvalidConfig
		}
		issueNo := counter.NextIssueNo
		if err := tx.Model(&counter).Update("next_issue_no", issueNo+1).Error; err != nil {
			return err
		}
		packets := make([]WelfareActivityRedPacket, len(quotas))
		for index, quota := range quotas {
			packets[index] = WelfareActivityRedPacket{IssueId: issue.Id, PacketIndex: index, Quota: quota}
		}
		if err := tx.CreateInBatches(&packets, 100).Error; err != nil {
			return err
		}
		now = common.GetTimestamp()
		issue.IssueNo, issue.Status = &issueNo, WelfareActivityStatusScheduled
		if issue.StartAt <= now {
			if err := finishActiveWelfareActivityTx(tx, now, actorId, "replaced by a new issue"); err != nil {
				return err
			}
			issue.Status = WelfareActivityStatusActive
		}
		issue.RemainingQuota, issue.RemainingCount = issue.TotalQuota, issue.PacketCount
		issue.DispatchedBy, issue.DispatchedAt, issue.UpdatedAt = actorId, now, now
		return tx.Save(&issue).Error
	})
	return &issue, err
}

func activateDueWelfareActivityTx(tx *gorm.DB, now int64) (*WelfareActivityIssue, error) {
	var issue WelfareActivityIssue
	err := lockForUpdate(tx).Where("status = ? AND start_at <= ?", WelfareActivityStatusScheduled, now).Order("issue_no asc").First(&issue).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := finishActiveWelfareActivityTx(tx, now, 0, "replaced by a scheduled issue"); err != nil {
		return nil, err
	}
	issue.Status, issue.UpdatedAt = WelfareActivityStatusActive, now
	return &issue, tx.Save(&issue).Error
}

func ActivateDueWelfareActivity(ctx context.Context) (*WelfareActivityIssue, error) {
	// 无到点期时只读，避免所有页面轮询都抢占领取的协调锁。
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	db := DB.WithContext(ctx)
	var count int64
	if err := db.Model(&WelfareActivityIssue{}).Where("status = ? AND start_at <= ?", WelfareActivityStatusScheduled, common.GetTimestamp()).Count(&count).Error; err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, nil
	}
	var issue *WelfareActivityIssue
	err := db.Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		var err error
		issue, err = activateDueWelfareActivityTx(tx, common.GetTimestamp())
		return err
	})
	return issue, err
}

func CancelWelfareActivityIssue(ctx context.Context, id, actorId int, reason string) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var rejection error
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		if _, err := activateDueWelfareActivityTx(tx, common.GetTimestamp()); err != nil {
			return err
		}
		var issue WelfareActivityIssue
		if err := lockForUpdate(tx).First(&issue, id).Error; err != nil {
			return err
		}
		if issue.Status == WelfareActivityStatusFinished || issue.Status == WelfareActivityStatusLegacyCancelled {
			return nil
		}
		if issue.Status != WelfareActivityStatusScheduled && issue.Status != WelfareActivityStatusActive {
			rejection = ErrWelfareActivityInvalidState
			return nil
		}
		now := common.GetTimestamp()
		return tx.Model(&issue).Updates(map[string]any{
			"status": WelfareActivityStatusFinished, "cancelled_by": actorId,
			"cancel_reason": reason, "cancelled_at": now, "finished_at": now, "updated_at": now,
		}).Error
	})
	if err != nil {
		return err
	}
	return rejection
}
