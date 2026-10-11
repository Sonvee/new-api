package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newSubscriptionOrderTestUser(t *testing.T, username string, group string) User {
	t.Helper()
	user := User{
		Username: username,
		Password: "unused-password-hash",
		Role:     1,
		Status:   1,
		Group:    group,
		AffCode:  username + "-aff",
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func TestUserSubscriptionSortOrderMigrationAndNewPurchasePriority(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	user := newSubscriptionOrderTestUser(t, "subscription-sort-user", "default")

	require.NoError(t, DB.Create(&UserSubscription{
		UserId:    user.Id,
		PlanId:    1,
		StartTime: now - 300,
		EndTime:   now + 300,
		Status:    "active",
		SortOrder: uninitializedUserSubscriptionSortOrder,
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:    user.Id,
		PlanId:    1,
		StartTime: now - 200,
		EndTime:   now + 600,
		Status:    "active",
		SortOrder: uninitializedUserSubscriptionSortOrder,
	}).Error)
	require.NoError(t, migrateUserSubscriptionSortOrder())

	var migrated []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).Order("sort_order desc").Find(&migrated).Error)
	require.Len(t, migrated, 2)
	assert.EqualValues(t, 2, migrated[0].SortOrder)
	assert.EqualValues(t, 1, migrated[1].SortOrder)
	assert.Greater(t, migrated[0].EndTime, migrated[1].EndTime)

	plan := &SubscriptionPlan{
		Title:         "Priority plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)
	newSubscription, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, "test")
	require.NoError(t, err)
	assert.EqualValues(t, 3, newSubscription.SortOrder)
}

func TestMoveUserSubscriptionSwapsAdjacentSubscriptionsAndRejectsBoundaries(t *testing.T) {
	truncateTables(t)
	user := newSubscriptionOrderTestUser(t, "subscription-move-user", "default")
	plan := &SubscriptionPlan{
		Title:         "Move plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)

	first, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, "test")
	require.NoError(t, err)
	second, err := CreateUserSubscriptionFromPlanTx(DB, user.Id, plan, "test")
	require.NoError(t, err)

	ordered, err := GetAllUserSubscriptions(user.Id)
	require.NoError(t, err)
	require.Len(t, ordered, 2)
	assert.Equal(t, second.Id, ordered[0].Subscription.Id)
	assert.Equal(t, first.Id, ordered[1].Subscription.Id)

	require.NoError(t, MoveUserSubscription(user.Id, second.Id, "down"))
	ordered, err = GetAllUserSubscriptions(user.Id)
	require.NoError(t, err)
	assert.Equal(t, first.Id, ordered[0].Subscription.Id)
	assert.Equal(t, second.Id, ordered[1].Subscription.Id)
	require.Error(t, MoveUserSubscription(user.Id, first.Id, "up"))
	require.Error(t, MoveUserSubscription(user.Id, second.Id, "down"))
	require.Error(t, MoveUserSubscription(user.Id+1, first.Id, "up"))
}

func TestCleanupInvalidUserSubscriptionsDeletesOnlyCurrentUserInvalidRowsAndDowngradesGroup(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	user := newSubscriptionOrderTestUser(t, "subscription-cleanup-user", "pro")
	otherUser := newSubscriptionOrderTestUser(t, "subscription-cleanup-other", "default")

	valid := &UserSubscription{
		UserId:    user.Id,
		PlanId:    1,
		StartTime: now - 100,
		EndTime:   now + 1000,
		Status:    "active",
		SortOrder: 3,
	}
	expired := &UserSubscription{
		UserId:        user.Id,
		PlanId:        1,
		StartTime:     now - 1000,
		EndTime:       now - 1,
		Status:        "active",
		UpgradeGroup:  "pro",
		PrevUserGroup: "default",
		SortOrder:     2,
	}
	cancelled := &UserSubscription{
		UserId:    user.Id,
		PlanId:    1,
		StartTime: now - 100,
		EndTime:   now + 1000,
		Status:    "cancelled",
		SortOrder: 1,
	}
	other := &UserSubscription{
		UserId:    otherUser.Id,
		PlanId:    1,
		StartTime: now - 100,
		EndTime:   now - 1,
		Status:    "expired",
		SortOrder: 1,
	}
	for _, sub := range []*UserSubscription{valid, expired, cancelled, other} {
		require.NoError(t, DB.Create(sub).Error)
	}

	deletedCount, err := CleanupInvalidUserSubscriptions(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 2, deletedCount)
	var remaining []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&remaining).Error)
	require.Len(t, remaining, 1)
	assert.Equal(t, valid.Id, remaining[0].Id)
	var updatedUser User
	require.NoError(t, DB.First(&updatedUser, user.Id).Error)
	assert.Equal(t, "default", updatedUser.Group)
	var otherRemaining UserSubscription
	require.NoError(t, DB.Where("id = ?", other.Id).First(&otherRemaining).Error)
	assert.Equal(t, other.Id, otherRemaining.Id)
}

func TestPreConsumeUserSubscriptionUsesHighestPriorityActiveSubscription(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	now := GetDBTimestamp()
	user := newSubscriptionOrderTestUser(t, "subscription-preconsume-user", "default")
	plan := &SubscriptionPlan{
		Title:         "Preconsume plan",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   100,
		Enabled:       true,
	}
	require.NoError(t, DB.Create(plan).Error)
	highPriority := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 100,
		StartTime:   now - 100,
		EndTime:     now + 1000,
		Status:      "active",
		SortOrder:   20,
	}
	lowPriority := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 100,
		StartTime:   now - 100,
		EndTime:     now + 1000,
		Status:      "active",
		SortOrder:   10,
	}
	require.NoError(t, DB.Create(highPriority).Error)
	require.NoError(t, DB.Create(lowPriority).Error)

	result, err := PreConsumeUserSubscription("subscription-order-request", user.Id, "test-model", 0, 25)
	require.NoError(t, err)
	assert.Equal(t, highPriority.Id, result.UserSubscriptionId)
	assert.EqualValues(t, 25, result.PreConsumed)
	var consumed UserSubscription
	require.NoError(t, DB.First(&consumed, highPriority.Id).Error)
	assert.EqualValues(t, 25, consumed.AmountUsed)
	var untouched UserSubscription
	require.NoError(t, DB.First(&untouched, lowPriority.Id).Error)
	assert.Zero(t, untouched.AmountUsed)
}
