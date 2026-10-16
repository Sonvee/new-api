package model

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// 请求必须指定用户实际看到的期号，网络重试不能领取已切换的新一期。
// 不接受客户端提供的中奖金额、用户 id 或任意幂等键。
func ClaimCurrentWelfareActivity(ctx context.Context, userId int, issueNo int64) (*WelfareActivityClaimView, bool, error) {
	if userId <= 0 || issueNo <= 0 {
		return nil, false, ErrWelfareActivityInvalidConfig
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	var claim WelfareActivityClaim
	alreadyClaimed := false
	var rejection error
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWelfareActivityTx(tx); err != nil {
			return err
		}
		now := common.GetTimestamp()
		// 每次领取先检查预约切换，即使旧一期仍有红包也不能绕过到点切换。
		if _, err := activateDueWelfareActivityTx(tx, now); err != nil {
			return err
		}
		var issue WelfareActivityIssue
		if err := lockForUpdate(tx).Where("issue_no = ?", issueNo).First(&issue).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				rejection = ErrWelfareActivityNotFound
				return nil
			}
			return err
		}
		var user User
		if err := lockForUpdate(tx).Select("id", "quota", "status").First(&user, userId).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			rejection = ErrWelfareActivityUnavailable
			return nil
		}
		err := tx.Where("issue_id = ? AND user_id = ?", issue.Id, userId).First(&claim).Error
		if err == nil {
			alreadyClaimed = true
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		switch {
		case issue.Status == WelfareActivityStatusLegacyCancelled:
			rejection = ErrWelfareActivityUnavailable
		case issue.StartAt > now:
			rejection = ErrWelfareActivityNotStarted
		case issue.Status == WelfareActivityStatusFinished || issue.RemainingCount <= 0:
			rejection = ErrWelfareActivitySoldOut
		case issue.Status != WelfareActivityStatusActive:
			rejection = ErrWelfareActivityUnavailable
		}
		// 正常业务拒绝提交必要的到点切换，但不会占用红包或修改用户余额。
		if rejection != nil {
			return nil
		}
		var packet WelfareActivityRedPacket
		if err := lockForUpdate(tx).Where("issue_id = ? AND claim_id IS NULL", issue.Id).Order("packet_index asc").First(&packet).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrWelfareActivitySoldOut
			}
			return err
		}
		if packet.Quota <= 0 || packet.Quota > issue.RemainingQuota {
			return errors.New("welfare packet quota invariant violated")
		}
		if user.Quota > common.MaxWalletQuota-packet.Quota {
			rejection = ErrWalletQuotaLimitExceeded
			return nil
		}
		claim = WelfareActivityClaim{IssueId: issue.Id, PacketId: packet.Id, UserId: userId, Quota: packet.Quota,
			IdempotencyKey: fmt.Sprintf("welfare:%d:%d", issue.Id, userId), CreatedAt: now}
		if err := tx.Create(&claim).Error; err != nil {
			return err
		}
		credit := tx.Model(&User{}).Where("id = ? AND quota <= ? AND status = ?", userId, common.MaxWalletQuota-packet.Quota, common.UserStatusEnabled).
			Update("quota", gorm.Expr("quota + ?", packet.Quota))
		if credit.Error != nil {
			return credit.Error
		}
		if credit.RowsAffected != 1 {
			return ErrWalletQuotaLimitExceeded
		}
		meta := WalletLedgerMeta{Type: WalletLedgerTypeWelfareActivity, SourceType: "welfare_red_packet", SourceId: fmt.Sprintf("%d", claim.Id)}
		if err := recordWalletLedgerTx(tx, userId, packet.Quota, user.Quota, user.Quota+packet.Quota, meta); err != nil {
			return err
		}
		var ledger WalletLedger
		if err := tx.Select("ledger_no").Where("idempotency_key = ?", walletLedgerIdempotencyKey(userId, meta, "")).First(&ledger).Error; err != nil {
			return err
		}
		claim.LedgerNo = ledger.LedgerNo
		if err := tx.Model(&claim).Update("ledger_no", claim.LedgerNo).Error; err != nil {
			return err
		}
		occupied := tx.Model(&WelfareActivityRedPacket{}).Where("id = ? AND claim_id IS NULL", packet.Id).Update("claim_id", claim.Id)
		if occupied.Error != nil {
			return occupied.Error
		}
		if occupied.RowsAffected != 1 {
			return ErrWelfareActivitySoldOut
		}
		issue.RemainingCount--
		issue.RemainingQuota -= packet.Quota
		if issue.RemainingCount == 0 {
			if issue.RemainingQuota != 0 {
				return errors.New("welfare issue quota invariant violated")
			}
			issue.Status, issue.FinishedAt = WelfareActivityStatusFinished, now
		}
		updated := tx.Model(&WelfareActivityIssue{}).Where("id = ? AND status = ?", issue.Id, WelfareActivityStatusActive).Updates(map[string]any{
			"remaining_count": issue.RemainingCount, "remaining_quota": issue.RemainingQuota,
			"status": issue.Status, "finished_at": issue.FinishedAt, "updated_at": now,
		})
		if updated.Error != nil {
			return updated.Error
		}
		if updated.RowsAffected != 1 {
			return ErrWelfareActivityUnavailable
		}
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	if rejection != nil {
		return nil, false, rejection
	}
	if !alreadyClaimed {
		// 复用授信缓存同步，只加增量，不覆盖尚未落库的预扣余额。
		syncCreditUserQuotaCache(userId, claim.Quota, "welfare activity")
	}
	return &WelfareActivityClaimView{Id: claim.Id, IssueNo: issueNo, Quota: claim.Quota, CreatedAt: claim.CreatedAt}, alreadyClaimed, nil
}
