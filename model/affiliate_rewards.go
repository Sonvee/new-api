package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const affiliateRewardMigrationVersion = "2"

type AffiliateCreditResult struct {
	InviterID    int
	InviterQuota int
	InviteeQuota int
	Activated    bool
}

type AffiliateInvitee struct {
	Username           string `json:"username"`
	CreatedAt          int64  `json:"created_at"`
	AffiliateActivated bool   `json:"affiliate_activated"`
}

type affiliateCreditKind uint8

const (
	affiliateCreditInvitation affiliateCreditKind = iota + 1
	affiliateCreditCommission
)

// migrateAffiliateRewardHistory keeps pre-existing invitation accounting on
// the old path while making new invitation relations use the new activation
// state machine.
func migrateAffiliateRewardHistory() error {
	var marker Option
	err := DB.Where("key = ?", "AffiliateRewardsMigrationVersion").First(&marker).Error
	if err == nil && marker.Value == affiliateRewardMigrationVersion {
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var pendingUsers []User
		if err := tx.Where("aff_quota > ?", 0).Find(&pendingUsers).Error; err != nil {
			return err
		}
		for i := range pendingUsers {
			pending := &pendingUsers[i]
			if pending.Quota > common.MaxWalletQuota-pending.AffQuota {
				return ErrWalletQuotaLimitExceeded
			}
			if err := tx.Model(&User{}).Where("id = ?", pending.Id).Updates(map[string]any{
				"quota":     gorm.Expr("quota + ?", pending.AffQuota),
				"aff_quota": 0,
			}).Error; err != nil {
				return err
			}
		}
		if err := tx.Model(&User{}).Where("inviter_id > ?", 0).Updates(map[string]any{
			"affiliate_activated": true,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).Where("aff_count > ?", 0).Updates(map[string]any{
			"aff_valid_count": gorm.Expr("aff_count"),
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&User{}).
			Where("aff_history > ? AND aff_reward_quota = ?", 0, 0).
			Updates(map[string]any{
				"aff_reward_quota": gorm.Expr("aff_history"),
			}).Error; err != nil {
			return err
		}
		return tx.Save(&Option{Key: "AffiliateRewardsMigrationVersion", Value: affiliateRewardMigrationVersion}).Error
	})
}

func affiliateCommissionQuota(creditedQuota int) int {
	if creditedQuota <= 0 || common.CommissionRate <= 0 {
		return 0
	}
	return common.QuotaFromDecimal(
		decimal.NewFromInt(int64(creditedQuota)).
			Mul(decimal.NewFromInt(int64(common.CommissionRate))).
			Div(decimal.NewFromInt(100)),
	)
}

func GetAffiliateInvitees(inviterID, startIdx, pageSize int) ([]AffiliateInvitee, int64, error) {
	invitees := make([]AffiliateInvitee, 0)
	query := DB.Model(&User{}).Where("inviter_id = ?", inviterID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return invitees, 0, err
	}

	err := query.Select("username, created_at, affiliate_activated").
		Order("created_at DESC, id DESC").
		Limit(pageSize).
		Offset(startIdx).
		Find(&invitees).Error
	return invitees, total, err
}

func creditAffiliateUserQuota(
	tx *gorm.DB,
	userID int,
	quota int,
	kind affiliateCreditKind,
) error {
	if quota <= 0 {
		return nil
	}
	if err := common.ValidateWalletQuota(quota); err != nil {
		return err
	}
	updates := map[string]any{
		"quota":       gorm.Expr("quota + ?", quota),
		"aff_history": gorm.Expr("aff_history + ?", quota),
	}
	if kind == affiliateCreditInvitation {
		updates["aff_reward_quota"] = gorm.Expr("aff_reward_quota + ?", quota)
	} else if kind == affiliateCreditCommission {
		updates["aff_commission_quota"] = gorm.Expr("aff_commission_quota + ?", quota)
	}

	result := tx.Model(&User{}).
		Where("id = ? AND quota <= ?", userID, common.MaxWalletQuota-quota).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}
	return ErrWalletQuotaLimitExceeded
}

func processAffiliateQuotaCredit(tx *gorm.DB, userID int, creditedQuota int, paymentTopUp bool) (AffiliateCreditResult, error) {
	result := AffiliateCreditResult{}
	if !operation_setting.IsPaymentComplianceConfirmed() {
		return result, nil
	}

	var invitee User
	if err := lockForUpdate(tx).First(&invitee, userID).Error; err != nil {
		return result, err
	}
	if invitee.InviterId == 0 {
		return result, nil
	}

	if !invitee.AffiliateActivated {
		if common.InvitationActivationThreshold > invitee.Quota {
			return result, nil
		}
		if err := tx.Model(&User{}).Where("id = ?", invitee.Id).Updates(map[string]any{
			"affiliate_activated": true,
		}).Error; err != nil {
			return result, err
		}
		if err := tx.Model(&User{}).Where("id = ?", invitee.InviterId).Updates(map[string]any{
			"aff_valid_count": gorm.Expr("aff_valid_count + ?", 1),
		}).Error; err != nil {
			return result, err
		}
		result.Activated = true
		result.InviterID = invitee.InviterId
		result.InviterQuota = common.QuotaForInviter
		result.InviteeQuota = common.QuotaForInvitee
		commissionQuota := 0
		if paymentTopUp {
			commissionQuota = affiliateCommissionQuota(creditedQuota)
			result.InviterQuota += commissionQuota
		}
		if err := creditAffiliateUserQuota(
			tx,
			invitee.Id,
			result.InviteeQuota,
			affiliateCreditInvitation,
		); err != nil {
			return result, err
		}
		if err := creditAffiliateUserQuota(
			tx,
			invitee.InviterId,
			common.QuotaForInviter,
			affiliateCreditInvitation,
		); err != nil {
			return result, err
		}
		if err := creditAffiliateUserQuota(
			tx,
			invitee.InviterId,
			commissionQuota,
			affiliateCreditCommission,
		); err != nil {
			return result, err
		}
		return result, nil
	}

	if paymentTopUp {
		result.InviterID = invitee.InviterId
		result.InviterQuota = affiliateCommissionQuota(creditedQuota)
		if err := creditAffiliateUserQuota(
			tx,
			result.InviterID,
			result.InviterQuota,
			affiliateCreditCommission,
		); err != nil {
			return result, err
		}
	}
	return result, nil
}

// ProcessAffiliateQuotaCredit evaluates activation after a non-payment credit.
func ProcessAffiliateQuotaCredit(userID int, creditedQuota int) error {
	var result AffiliateCreditResult
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		result, err = processAffiliateQuotaCredit(tx, userID, creditedQuota, false)
		return err
	})
	if err != nil {
		return err
	}
	syncCreditUserQuotaCache(userID, result.InviteeQuota, "affiliate invitee reward")
	syncCreditUserQuotaCache(result.InviterID, result.InviterQuota, "affiliate inviter reward")
	return nil
}
