package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestBillingRecordsQueriesScopeAndFilterCurrentUser(t *testing.T) {
	truncateTables(t)

	user := &User{Username: "billing-records-user", Password: "password", Status: common.UserStatusEnabled, AffCode: "billing-user"}
	otherUser := &User{Username: "billing-records-other", Password: "password", Status: common.UserStatusEnabled, AffCode: "billing-other"}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, DB.Create(otherUser).Error)

	require.NoError(t, DB.Create(&TopUp{UserId: user.Id, TradeNo: "topup-user", Amount: 1, PaymentMethod: "alipay", Money: 12.5, Status: common.TopUpStatusSuccess, CreateTime: 100}).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: otherUser.Id, TradeNo: "topup-other", PaymentMethod: "alipay", Money: 20, Status: common.TopUpStatusSuccess, CreateTime: 200}).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: user.Id, TradeNo: "subscription-user", Amount: 0, PaymentMethod: "wxpay", Money: 8, Status: common.TopUpStatusSuccess, CreateTime: 301}).Error)
	require.NoError(t, DB.Create(&TopUp{UserId: user.Id, TradeNo: "admin-topup-user", Amount: 1, PaymentMethod: "alipay", Money: 1, Status: common.TopUpStatusSuccess, CreateTime: 302}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{UserId: user.Id, TradeNo: "subscription-user", PaymentMethod: "wxpay", PaymentProvider: PaymentProviderEpay, Money: 8, Status: common.TopUpStatusPending, CreateTime: 300}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{UserId: user.Id, TradeNo: "subscription-balance", PaymentMethod: PaymentMethodBalance, PaymentProvider: PaymentProviderBalance, Money: 5, Status: common.TopUpStatusSuccess, CreateTime: 400}).Error)
	require.NoError(t, DB.Create(&WalletLedger{UserId: user.Id, LedgerNo: "ledger-user", Type: WalletLedgerTypeTopup, DeltaQuota: 100, BalanceBefore: 0, BalanceAfter: 100, SourceType: "topup", SourceId: "topup-user", IdempotencyKey: "ledger-user-key", CreatedAt: 100}).Error)
	require.NoError(t, DB.Create(&WalletLedger{UserId: otherUser.Id, LedgerNo: "ledger-other", Type: WalletLedgerTypeTopup, DeltaQuota: 200, BalanceBefore: 0, BalanceAfter: 200, SourceType: "topup", SourceId: "topup-other", IdempotencyKey: "ledger-other-key", CreatedAt: 200}).Error)
	require.NoError(t, DB.Create(&WalletLedger{UserId: user.Id, LedgerNo: "ledger-admin", Type: WalletLedgerTypeAdminTopup, DeltaQuota: 500, BalanceBefore: 100, BalanceAfter: 600, SourceType: "topup", SourceId: "admin-topup-user", IdempotencyKey: "ledger-admin-key", CreatedAt: 302}).Error)

	page := &common.PageInfo{Page: 1, PageSize: 10}
	records, total, err := GetUserBillingConsumptions(user.Id, page, BillingConsumptionFilter{})
	require.NoError(t, err)
	for _, record := range records {
		t.Logf("record=%+v", *record)
	}
	t.Logf("total=%d", total)
	require.Equal(t, int64(2), total)
	require.Len(t, records, 2)
	require.Equal(t, "subscription-user", records[0].BillNo)

	records, total, err = GetUserBillingConsumptions(user.Id, page, BillingConsumptionFilter{Type: "topup"})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, records, 1)
	require.Equal(t, "topup-user", records[0].BillNo)

	ledgers, total, err := GetUserWalletLedgers(user.Id, page, "ledger-user", "", "", 0, 0)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, ledgers, 1)
	require.Equal(t, "ledger-user", ledgers[0].LedgerNo)
}
