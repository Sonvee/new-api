package main

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

func runDryRun(db *gorm.DB, pf preflight, report *report) error {
	if pf.marker == migrationVersion {
		report.add("dry-run", "migration", "already completed; no changes planned")
		return nil
	}
	if pf.marker == previousMigrationVersion {
		report.add("dry-run", "reconcile affiliate history", fmt.Sprintf("users=%d", pf.affiliateHistoryRows))
		return nil
	}
	report.add("dry-run", "backfill invite relations", fmt.Sprintf("rows=%d", pf.legacyRelationsMissing))
	report.add("dry-run", "reconcile affiliate balances", fmt.Sprintf("rows=%d", pf.affiliateBalanceRows))
	report.add("dry-run", "rebuild persisted affiliate fields", fmt.Sprintf("users=%d", pf.users))
	report.add("dry-run", "import quota ledgers", fmt.Sprintf("rows=%d", pf.quotaLedgers))
	report.add("dry-run", "invalidate authentication state", fmt.Sprintf("user_sessions=%d auth_flows=%d users=%d", pf.authSessions, pf.authFlows, pf.users))
	return nil
}

func runApply(db *gorm.DB, pf preflight, report *report) error {
	if pf.marker == migrationVersion {
		report.add("apply", "migration", "already completed; no changes made")
		return nil
	}
	if pf.marker == previousMigrationVersion {
		return db.Transaction(func(tx *gorm.DB) error {
			if rows, err := reconcileAffiliateHistory(tx); err != nil {
				return err
			} else {
				report.add("apply", "reconcile affiliate history", fmt.Sprintf("users=%d", rows))
			}
			if err := writeMarker(tx); err != nil {
				return err
			}
			report.add("apply", "migration marker", migrationVersion)
			return nil
		})
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if rows, err := backfillLegacyRelations(tx); err != nil {
			return err
		} else {
			report.add("apply", "backfill invite relations", fmt.Sprintf("rows=%d", rows))
		}
		if rows, err := reconcileAffiliateBalances(tx); err != nil {
			return err
		} else {
			report.add("apply", "reconcile affiliate balances", fmt.Sprintf("rows=%d", rows))
		}
		if rows, err := rebuildAffiliateFields(tx); err != nil {
			return err
		} else {
			report.add("apply", "rebuild persisted affiliate fields", fmt.Sprintf("users=%d", rows))
		}
		if rows, err := importQuotaLedgers(tx); err != nil {
			return err
		} else {
			report.add("apply", "import quota ledgers", fmt.Sprintf("rows=%d", rows))
		}
		if sessions, flows, users, err := invalidateAuthenticationState(tx); err != nil {
			return err
		} else {
			report.add("apply", "invalidate authentication state", fmt.Sprintf("user_sessions=%d auth_flows=%d users=%d", sessions, flows, users))
		}
		if err := writeAuthInvalidationMarker(tx); err != nil {
			return err
		}
		if err := writeMarker(tx); err != nil {
			return err
		}
		report.add("apply", "migration marker", migrationVersion)
		return nil
	})
}

func backfillLegacyRelations(tx *gorm.DB) (int64, error) {
	result := tx.Exec(`
		INSERT INTO invite_relations (
			inviter_id, invitee_id, status, bind_time, activation_time,
			activation_top_up_id, threshold_snapshot, activation_mode, skip_fixed_rewards
		)
		SELECT u.inviter_id, u.id, 'pending',
			COALESCE(NULLIF(u.created_at, 0), EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::bigint),
			0, NULL, 0, 'legacy', TRUE
		FROM users u
		WHERE u.inviter_id > 0
		  AND u.inviter_id <> u.id
		  AND EXISTS (SELECT 1 FROM users inviter WHERE inviter.id = u.inviter_id)
		  AND NOT EXISTS (SELECT 1 FROM invite_relations r WHERE r.invitee_id = u.id)
		ON CONFLICT (invitee_id) DO NOTHING`)
	return result.RowsAffected, result.Error
}

func reconcileAffiliateBalances(tx *gorm.DB) (int64, error) {
	var invalid int64
	if err := tx.Raw(`
		SELECT COUNT(*)
		FROM users
		WHERE aff_quota < 0
		   OR quota > ? - aff_quota
		   OR quota < ? - aff_quota`, common.MaxWalletQuota, -common.MaxWalletQuota).Scan(&invalid).Error; err != nil {
		return 0, err
	}
	if invalid != 0 {
		return 0, fmt.Errorf("%d users have affiliate balances outside the wallet quota range", invalid)
	}
	result := tx.Exec(`
		UPDATE users
		SET quota = quota + aff_quota,
			aff_quota = 0
		WHERE aff_quota <> 0`)
	return result.RowsAffected, result.Error
}

func reconcileAffiliateHistory(tx *gorm.DB) (int64, error) {
	result := tx.Exec(`
		UPDATE users
		SET aff_history = COALESCE(aff_reward_quota, 0) + COALESCE(aff_commission_quota, 0)
		WHERE aff_history <> COALESCE(aff_reward_quota, 0) + COALESCE(aff_commission_quota, 0)`)
	return result.RowsAffected, result.Error
}

func rebuildAffiliateFields(tx *gorm.DB) (int64, error) {
	result := tx.Exec(`
		WITH affiliate_totals AS (
			SELECT
				u.id,
				CASE
					WHEN EXISTS (SELECT 1 FROM invite_rewards ir WHERE ir.recipient_id = u.id)
					THEN COALESCE((
						SELECT SUM(ir.quota) FROM invite_rewards ir
						WHERE ir.recipient_id = u.id AND ir.status = 'success'
					), 0)
					ELSE COALESCE(u.aff_history, 0)
				END AS reward_quota,
				COALESCE((
					SELECT SUM(rc.commission_quota) FROM recharge_commissions rc
					WHERE rc.inviter_id = u.id AND rc.status = 'success'
				), 0) AS commission_quota
			FROM users AS u
		)
		UPDATE users AS u
		SET aff_count = (
				SELECT COUNT(*) FROM invite_relations r WHERE r.inviter_id = u.id
			),
			aff_valid_count = (
				SELECT COUNT(*) FROM invite_relations r WHERE r.inviter_id = u.id AND r.status = 'active'
			),
			aff_reward_quota = totals.reward_quota,
			aff_commission_quota = totals.commission_quota,
			aff_history = totals.reward_quota + totals.commission_quota,
			affiliate_activated = (u.inviter_id > 0)
		FROM affiliate_totals AS totals
		WHERE u.id = totals.id`)
	return result.RowsAffected, result.Error
}

func importQuotaLedgers(tx *gorm.DB) (int64, error) {
	result := tx.Exec(`
		INSERT INTO wallet_ledgers (
			user_id, ledger_no, type, delta_quota, balance_before, balance_after,
			source_type, source_id, idempotency_key, created_at
		)
		SELECT q.user_id,
			'Llegacy-quota-' || q.id::text,
			q.type,
			q.quota_delta,
			q.balance_after - q.quota_delta,
			q.balance_after,
			q.source_type,
			q.source_id::text,
			'legacy:quota_ledgers:' || q.id::text,
			q.create_time
		FROM quota_ledgers q
		ON CONFLICT (idempotency_key) DO NOTHING`)
	return result.RowsAffected, result.Error
}

func invalidateAuthenticationState(tx *gorm.DB) (int64, int64, int64, error) {
	sessions := tx.Exec(`DELETE FROM user_sessions`)
	if sessions.Error != nil {
		return 0, 0, 0, sessions.Error
	}
	flows := tx.Exec(`DELETE FROM auth_flows`)
	if flows.Error != nil {
		return sessions.RowsAffected, 0, 0, flows.Error
	}
	users := tx.Exec(`UPDATE users SET auth_version = GREATEST(auth_version + 1, 1)`)
	if users.Error != nil {
		return sessions.RowsAffected, flows.RowsAffected, 0, users.Error
	}
	return sessions.RowsAffected, flows.RowsAffected, users.RowsAffected, nil
}

func writeOption(tx *gorm.DB, key, value string) error {
	return tx.Exec(`
		INSERT INTO options (key, value) VALUES (?, ?)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, key, value).Error
}

func writeMarker(tx *gorm.DB) error {
	return writeOption(tx, markerKey, migrationVersion)
}

func writeAuthInvalidationMarker(tx *gorm.DB) error {
	return writeOption(tx, authInvalidationMarkerKey, migrationVersion)
}

func runVerify(db *gorm.DB, report *report) error {
	marker, err := readMarker(db)
	if err != nil {
		return fmt.Errorf("read migration marker: %w", err)
	}
	if marker != migrationVersion {
		return fmt.Errorf("migration marker is %q, expected %q", marker, migrationVersion)
	}
	report.add("verify", "migration marker", "correct")

	authMarker, err := readOption(db, authInvalidationMarkerKey)
	if err != nil {
		return fmt.Errorf("read authentication migration marker: %w", err)
	}

	checks := []struct {
		name  string
		query string
	}{
		{
			name:  "affiliate count",
			query: `SELECT COUNT(*) FROM users u WHERE u.aff_count <> (SELECT COUNT(*) FROM invite_relations r WHERE r.inviter_id = u.id)`,
		},
		{
			name:  "valid affiliate count",
			query: `SELECT COUNT(*) FROM users u WHERE u.aff_valid_count <> (SELECT COUNT(*) FROM invite_relations r WHERE r.inviter_id = u.id AND r.status = 'active')`,
		},
		{
			name:  "invitation reward quota",
			query: `SELECT COUNT(*) FROM users u WHERE EXISTS (SELECT 1 FROM invite_rewards ir WHERE ir.recipient_id = u.id) AND u.aff_reward_quota <> COALESCE((SELECT SUM(ir.quota) FROM invite_rewards ir WHERE ir.recipient_id = u.id AND ir.status = 'success'), 0)`,
		},
		{
			name:  "commission quota",
			query: `SELECT COUNT(*) FROM users u WHERE u.aff_commission_quota <> COALESCE((SELECT SUM(rc.commission_quota) FROM recharge_commissions rc WHERE rc.inviter_id = u.id AND rc.status = 'success'), 0)`,
		},
		{
			name:  "affiliate history",
			query: `SELECT COUNT(*) FROM users u WHERE u.aff_history <> COALESCE(u.aff_reward_quota, 0) + COALESCE(u.aff_commission_quota, 0)`,
		},
		{
			name:  "affiliate activation",
			query: `SELECT COUNT(*) FROM users WHERE affiliate_activated <> (inviter_id > 0)`,
		},
		{
			name:  "affiliate balance cleared",
			query: `SELECT COUNT(*) FROM users WHERE aff_quota <> 0`,
		},
		{
			name:  "quota ledgers imported",
			query: `SELECT COUNT(*) FROM quota_ledgers q WHERE NOT EXISTS (SELECT 1 FROM wallet_ledgers w WHERE w.idempotency_key = 'legacy:quota_ledgers:' || q.id::text)`,
		},
	}
	if authMarker == migrationVersion {
		checks = append(checks,
			struct {
				name  string
				query string
			}{name: "user sessions invalidated", query: `SELECT COUNT(*) FROM user_sessions`},
			struct {
				name  string
				query string
			}{name: "auth flows invalidated", query: `SELECT COUNT(*) FROM auth_flows`},
		)
	} else {
		report.add("verify", "authentication state", "preserved by corrective migration")
	}
	for _, check := range checks {
		var count int64
		if err := db.Raw(check.query).Scan(&count).Error; err != nil {
			return fmt.Errorf("verify %s: %w", check.name, err)
		}
		report.add("verify", check.name, fmt.Sprintf("violations=%d", count))
		if count != 0 {
			return fmt.Errorf("verification failed for %s: violations=%d", check.name, count)
		}
	}
	return nil
}
