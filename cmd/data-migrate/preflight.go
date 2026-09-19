package main

import (
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"
)

type preflight struct {
	marker                 string
	users                  int64
	inviteRelations        int64
	inviteRewards          int64
	rechargeCommissions    int64
	quotaLedgers           int64
	walletLedgers          int64
	legacyRelationsMissing int64
	affiliateBalanceRows   int64
	authSessions           int64
	authFlows              int64
}

var requiredColumns = map[string][]string{
	"users": {
		"id", "inviter_id", "aff_count", "aff_quota", "aff_history", "aff_reward_quota",
		"aff_commission_quota", "aff_valid_count", "affiliate_activated", "auth_version",
	},
	"invite_relations":     {"id", "inviter_id", "invitee_id", "status"},
	"invite_rewards":       {"id", "relation_id", "recipient_id", "quota", "status"},
	"recharge_commissions": {"id", "inviter_id", "commission_quota", "status"},
	"quota_ledgers":        {"id", "user_id", "type", "quota_delta", "balance_after", "source_type", "source_id", "idempotency_key", "create_time"},
	"wallet_ledgers":       {"id", "user_id", "ledger_no", "type", "delta_quota", "balance_before", "balance_after", "source_type", "source_id", "idempotency_key", "created_at"},
	"user_sessions":        {"sid", "user_id", "status", "refresh_hash"},
	"auth_flows":           {"id", "token_hash", "purpose", "expires_at"},
	"options":              {"key", "value"},
}

var requiredTables = []string{
	"abilities", "channels", "checkins", "custom_oauth_providers", "logs", "manual_expense_records",
	"manual_income_records", "midjourneys", "models", "options", "passkey_credentials", "perf_metrics",
	"prefill_groups", "quota_data", "quota_ledgers", "redemptions", "setups", "subscription_orders",
	"subscription_plans", "subscription_pre_consume_records", "system_instances", "system_task_locks",
	"system_tasks", "tasks", "tokens", "top_ups", "two_fa_backup_codes", "two_fas", "user_oauth_bindings",
	"user_subscriptions", "users", "vendors", "invite_relations", "invite_rewards", "recharge_commissions",
	"accounting_entries", "audit_logs", "auth_flows", "external_identity_claims", "login_encryption_keys",
	"task_plugins", "user_sessions", "wallet_ledgers",
}

var mergeSensitiveTables = []string{
	"accounting_entries", "audit_logs", "external_identity_claims", "login_encryption_keys", "task_plugins", "wallet_ledgers",
}

var requiredUniqueIndexes = map[string][]string{
	"invite_relations": {"invitee_id"},
	"wallet_ledgers":   {"idempotency_key", "ledger_no"},
	"options":          {"key"},
}

func runPreflight(db *gorm.DB, report *report) (preflight, error) {
	result := preflight{}
	var err error
	result.marker, err = readMarker(db)
	if err != nil {
		return result, fmt.Errorf("read migration marker: %w", err)
	}
	report.add("check", "migration marker", markerDetail(result.marker))
	if result.marker != "" && result.marker != migrationVersion {
		return result, fmt.Errorf("database was migrated by unsupported version %q", result.marker)
	}

	tables := append([]string(nil), requiredTables...)
	sort.Strings(tables)
	for _, table := range tables {
		exists, checkErr := hasTable(db, table)
		if checkErr != nil {
			return result, fmt.Errorf("check table %s: %w", table, checkErr)
		}
		if !exists {
			return result, fmt.Errorf("required PostgreSQL table is missing: %s", table)
		}
		report.add("schema", table, "present")
	}

	columnTables := make([]string, 0, len(requiredColumns))
	for table := range requiredColumns {
		columnTables = append(columnTables, table)
	}
	sort.Strings(columnTables)
	for _, table := range columnTables {
		columns := append([]string(nil), requiredColumns[table]...)
		sort.Strings(columns)
		for _, column := range columns {
			exists, checkErr := hasColumn(db, table, column)
			if checkErr != nil {
				return result, fmt.Errorf("check column %s.%s: %w", table, column, checkErr)
			}
			if !exists {
				return result, fmt.Errorf("required PostgreSQL column is missing: %s.%s", table, column)
			}
		}
	}

	indexTables := make([]string, 0, len(requiredUniqueIndexes))
	for table := range requiredUniqueIndexes {
		indexTables = append(indexTables, table)
	}
	sort.Strings(indexTables)
	for _, table := range indexTables {
		for _, column := range requiredUniqueIndexes[table] {
			exists, checkErr := hasUniqueIndex(db, table, column)
			if checkErr != nil {
				return result, fmt.Errorf("check unique index %s.%s: %w", table, column, checkErr)
			}
			if !exists {
				return result, fmt.Errorf("required unique index is missing: %s.%s", table, column)
			}
		}
	}

	counts := map[string]*int64{
		"users":                &result.users,
		"invite_relations":     &result.inviteRelations,
		"invite_rewards":       &result.inviteRewards,
		"recharge_commissions": &result.rechargeCommissions,
		"quota_ledgers":        &result.quotaLedgers,
		"wallet_ledgers":       &result.walletLedgers,
		"user_sessions":        &result.authSessions,
		"auth_flows":           &result.authFlows,
	}
	for table, count := range counts {
		*count, err = countRows(db, table)
		if err != nil {
			return result, fmt.Errorf("count %s: %w", table, err)
		}
		report.add("data", table, fmt.Sprintf("rows=%d", *count))
	}

	result.legacyRelationsMissing, err = countMissingLegacyRelations(db)
	if err != nil {
		return result, fmt.Errorf("inspect legacy invite relations: %w", err)
	}
	result.affiliateBalanceRows, err = countNonZeroRows(db, "users", "aff_quota <> 0")
	if err != nil {
		return result, fmt.Errorf("inspect legacy affiliate balances: %w", err)
	}
	report.add("plan", "legacy invite relations", fmt.Sprintf("rows_to_backfill=%d", result.legacyRelationsMissing))
	report.add("plan", "legacy affiliate balances", fmt.Sprintf("rows_to_reconcile=%d", result.affiliateBalanceRows))

	if result.marker == migrationVersion {
		report.add("check", "repeat execution", "migration already completed; apply will not write again")
		return result, nil
	}
	for _, table := range mergeSensitiveTables {
		count, countErr := countRows(db, table)
		if countErr != nil {
			return result, fmt.Errorf("count merge-sensitive table %s: %w", table, countErr)
		}
		if count != 0 {
			return result, fmt.Errorf("target database is not fresh: %s contains %d rows", table, count)
		}
	}
	if result.walletLedgers != 0 {
		return result, fmt.Errorf("target database is not fresh: wallet_ledgers contains %d rows", result.walletLedgers)
	}
	return result, nil
}

func markerDetail(marker string) string {
	if marker == "" {
		return "not set"
	}
	return marker
}

func hasTable(db *gorm.DB, table string) (bool, error) {
	var exists bool
	err := db.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.tables
			WHERE table_schema = 'public' AND table_name = ?
		)`, table).Scan(&exists).Error
	return exists, err
}

func hasColumn(db *gorm.DB, table, column string) (bool, error) {
	var exists bool
	err := db.Raw(`
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
		)`, table, column).Scan(&exists).Error
	return exists, err
}

func hasUniqueIndex(db *gorm.DB, table, column string) (bool, error) {
	var exists bool
	err := db.Raw(`
		SELECT EXISTS (
			SELECT 1
			FROM pg_indexes
			WHERE schemaname = 'public'
			  AND tablename = ?
			  AND indexdef ILIKE '%UNIQUE%(' || ? || ')%'
		)`, table, column).Scan(&exists).Error
	return exists, err
}

func countRows(db *gorm.DB, table string) (int64, error) {
	var count int64
	if err := db.Table(table).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func countNonZeroRows(db *gorm.DB, table, predicate string) (int64, error) {
	var count int64
	if err := db.Table(table).Where(predicate).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func countMissingLegacyRelations(db *gorm.DB) (int64, error) {
	var count int64
	err := db.Raw(`
		SELECT COUNT(*)
		FROM users u
		WHERE u.inviter_id > 0
		  AND u.inviter_id <> u.id
		  AND EXISTS (SELECT 1 FROM users inviter WHERE inviter.id = u.inviter_id)
		  AND NOT EXISTS (SELECT 1 FROM invite_relations r WHERE r.invitee_id = u.id)`).Scan(&count).Error
	return count, err
}

func readMarker(db *gorm.DB) (string, error) {
	var row struct {
		Value string
	}
	if err := db.Raw(`SELECT value FROM options WHERE key = ?`, markerKey).Scan(&row).Error; err != nil {
		return "", err
	}
	return strings.TrimSpace(row.Value), nil
}
