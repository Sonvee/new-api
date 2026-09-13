package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	WalletLedgerTypeTopup            = "topup"
	WalletLedgerTypeRedemption       = "redemption"
	WalletLedgerTypeAdminTopup       = "admin_topup"
	WalletLedgerTypeSubscription     = "subscription"
	WalletLedgerTypeAdminAdjustment  = "admin_adjustment"
	WalletLedgerTypeInvitationReward = "invitation_reward"
	WalletLedgerTypeCommission       = "commission"
	WalletLedgerTypeCheckin          = "checkin"
	WalletLedgerTypeSystemGrant      = "system_grant"
)

type WalletLedger struct {
	Id             int    `json:"id" gorm:"index:idx_wallet_ledger_user_created,priority:2"`
	UserId         int    `json:"user_id" gorm:"index:idx_wallet_ledger_user_created,priority:1"`
	LedgerNo       string `json:"ledger_no" gorm:"uniqueIndex;type:varchar(64)"`
	Type           string `json:"type" gorm:"index;type:varchar(50)"`
	DeltaQuota     int    `json:"delta_quota" gorm:"type:bigint"`
	BalanceBefore  int    `json:"balance_before" gorm:"type:bigint"`
	BalanceAfter   int    `json:"balance_after" gorm:"type:bigint"`
	SourceType     string `json:"source_type" gorm:"index;type:varchar(50);default:''"`
	SourceId       string `json:"source_id" gorm:"index;type:varchar(255);default:''"`
	IdempotencyKey string `json:"-" gorm:"uniqueIndex;type:varchar(255)"`
	CreatedAt      int64  `json:"created_at" gorm:"index:idx_wallet_ledger_user_created,priority:3"`
}

type WalletLedgerMeta struct {
	Type       string
	SourceType string
	SourceId   string
}

func newWalletLedgerNo() string {
	return "L" + common.GetUUID()
}

func walletLedgerIdempotencyKey(userId int, meta WalletLedgerMeta, ledgerNo string) string {
	if meta.SourceType == "" || meta.SourceId == "" {
		return ledgerNo
	}
	return fmt.Sprintf("%d:%s:%s:%s", userId, meta.Type, meta.SourceType, meta.SourceId)
}

func recordWalletLedgerTx(tx *gorm.DB, userId int, delta int, before int, after int, meta WalletLedgerMeta) error {
	if tx == nil || userId <= 0 || delta == 0 {
		return errors.New("invalid wallet ledger arguments")
	}
	if after-before != delta {
		return errors.New("wallet ledger balance invariant violated")
	}
	ledgerNo := newWalletLedgerNo()
	return tx.Create(&WalletLedger{
		UserId:         userId,
		LedgerNo:       ledgerNo,
		Type:           meta.Type,
		DeltaQuota:     delta,
		BalanceBefore:  before,
		BalanceAfter:   after,
		SourceType:     meta.SourceType,
		SourceId:       meta.SourceId,
		IdempotencyKey: walletLedgerIdempotencyKey(userId, meta, ledgerNo),
		CreatedAt:      common.GetTimestamp(),
	}).Error
}

func GetUserWalletLedgers(userId int, pageInfo *common.PageInfo, keyword string, ledgerType string, direction string, startTime int64, endTime int64) ([]*WalletLedger, int64, error) {
	query := DB.Model(&WalletLedger{}).Where("user_id = ?", userId)
	if keyword != "" {
		pattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where("(ledger_no LIKE ? ESCAPE '!' OR source_id LIKE ? ESCAPE '!')", pattern, pattern)
	}
	if ledgerType != "" {
		query = query.Where("type = ?", ledgerType)
	}
	switch direction {
	case "increase":
		query = query.Where("delta_quota > 0")
	case "decrease":
		query = query.Where("delta_quota < 0")
	}
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []*WalletLedger
	if err := query.Order("created_at desc, id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&items).Error; err != nil {
		return nil, 0, err
	}
	return items, total, nil
}
