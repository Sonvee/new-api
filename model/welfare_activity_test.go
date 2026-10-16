package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestValidateWelfareActivityConfig(t *testing.T) {
	tests := []struct {
		name        string
		totalQuota  int
		packetCount int
		minQuota    int
		wantErr     bool
	}{
		{name: "minimum starts at one unit", totalQuota: 10, packetCount: 5, minQuota: 1},
		{name: "minimum is bounded by average", totalQuota: 10, packetCount: 5, minQuota: 2},
		{name: "total must cover every packet", totalQuota: 4, packetCount: 5, minQuota: 0, wantErr: true},
		{name: "minimum cannot exceed average", totalQuota: 10, packetCount: 5, minQuota: 3, wantErr: true},
		{name: "zero minimum is rejected", totalQuota: 10, packetCount: 5, minQuota: 0, wantErr: true},
		{name: "negative minimum is rejected", totalQuota: 10, packetCount: 5, minQuota: -1, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := ValidateWelfareActivityConfig(test.totalQuota, test.packetCount, test.minQuota, 1)
			if test.wantErr {
				require.ErrorIs(t, err, ErrWelfareActivityInvalidConfig)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestWelfareActivityIssueToSummaryNormalizesLegacyCancelledStatus(t *testing.T) {
	issue := &WelfareActivityIssue{Id: 1, Status: WelfareActivityStatusLegacyCancelled}
	summary := WelfareActivityIssueToSummary(issue)
	require.NotNil(t, summary)
	assert.Equal(t, WelfareActivityStatusFinished, summary.Status)
}

func TestGenerateWelfareActivityQuotas(t *testing.T) {
	tests := []struct {
		name        string
		totalQuota  int
		packetCount int
		minQuota    int
	}{
		{name: "minimum gives every packet one unit", totalQuota: 5, packetCount: 5, minQuota: 1},
		{name: "remaining quota is randomly split after the guarantee", totalQuota: 10, packetCount: 5, minQuota: 1},
		{name: "average minimum consumes the whole total", totalQuota: 10, packetCount: 5, minQuota: 2},
		{name: "non divisible total", totalQuota: 7, packetCount: 3, minQuota: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			quotas, err := generateWelfareActivityQuotas(test.totalQuota, test.packetCount, test.minQuota)
			require.NoError(t, err)
			require.Len(t, quotas, test.packetCount)

			sum := 0
			for _, quota := range quotas {
				assert.GreaterOrEqual(t, quota, 1)
				assert.GreaterOrEqual(t, quota, test.minQuota)
				sum += quota
			}
			assert.Equal(t, test.totalQuota, sum)
		})
	}
}

func TestGetCurrentWelfareActivityKeepsFinishedIssue(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	require.NoError(t, db.AutoMigrate(&WelfareActivityIssue{}, &WelfareActivityIssueCounter{}, &WelfareActivityClaim{}))
	require.NoError(t, db.Create(&WelfareActivityIssueCounter{Id: 1, NextIssueNo: 2}).Error)
	issueNo := int64(1)
	issue := WelfareActivityIssue{
		IssueNo:        &issueNo,
		ActivityType:   WelfareActivityTypeRedPacket,
		Status:         WelfareActivityStatusFinished,
		TotalQuota:     10,
		PacketCount:    2,
		MinQuota:       1,
		RemainingQuota: 0,
		RemainingCount: 0,
		StartAt:        1,
	}
	require.NoError(t, db.Create(&issue).Error)
	require.NoError(t, db.Create(&WelfareActivityClaim{IssueId: issue.Id, UserId: 7, Quota: 6, CreatedAt: 2}).Error)

	current, err := GetCurrentWelfareActivity(t.Context(), 7)
	require.NoError(t, err)
	require.NotNil(t, current.Issue)
	assert.Equal(t, int64(1), current.Issue.IssueNo)
	assert.Equal(t, WelfareActivityStatusFinished, current.Issue.Status)
	require.NotNil(t, current.Issue.Claim)
	assert.Equal(t, 6, current.Issue.Claim.Quota)
}
func TestCancelWelfareActivityIssueAllowsActive(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	require.NoError(t, db.AutoMigrate(&WelfareActivityIssue{}, &WelfareActivityIssueCounter{}))
	require.NoError(t, db.Create(&WelfareActivityIssueCounter{Id: 1, NextIssueNo: 2}).Error)
	issueNo := int64(1)
	issue := WelfareActivityIssue{
		IssueNo:        &issueNo,
		ActivityType:   WelfareActivityTypeRedPacket,
		Status:         WelfareActivityStatusActive,
		TotalQuota:     10,
		PacketCount:    2,
		MinQuota:       1,
		RemainingQuota: 4,
		RemainingCount: 1,
		StartAt:        1,
	}
	require.NoError(t, db.Create(&issue).Error)

	require.NoError(t, CancelWelfareActivityIssue(t.Context(), issue.Id, 9, "ended by administrator"))

	var updated WelfareActivityIssue
	require.NoError(t, db.First(&updated, issue.Id).Error)
	assert.Equal(t, WelfareActivityStatusFinished, updated.Status)
	assert.Equal(t, 9, updated.CancelledBy)
	assert.Equal(t, "ended by administrator", updated.CancelReason)
}
func TestDeleteWelfareActivityScheduledIssue(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	require.NoError(t, db.AutoMigrate(&WelfareActivityIssue{}, &WelfareActivityIssueCounter{}, &WelfareActivityRedPacket{}))
	require.NoError(t, db.Create(&WelfareActivityIssueCounter{Id: 1, NextIssueNo: 2}).Error)
	issueNo := int64(1)
	issue := WelfareActivityIssue{
		IssueNo:        &issueNo,
		ActivityType:   WelfareActivityTypeRedPacket,
		Status:         WelfareActivityStatusScheduled,
		TotalQuota:     10,
		PacketCount:    2,
		MinQuota:       1,
		RemainingQuota: 10,
		RemainingCount: 2,
		StartAt:        253402271999,
	}
	require.NoError(t, db.Create(&issue).Error)
	require.NoError(t, db.Create(&WelfareActivityRedPacket{IssueId: issue.Id, PacketIndex: 0, Quota: 4}).Error)

	require.NoError(t, DeleteWelfareActivityDraft(t.Context(), issue.Id))

	var deleted WelfareActivityIssue
	assert.ErrorIs(t, db.First(&deleted, issue.Id).Error, gorm.ErrRecordNotFound)
	var packets int64
	require.NoError(t, db.Model(&WelfareActivityRedPacket{}).Where("issue_id = ?", issue.Id).Count(&packets).Error)
	assert.Zero(t, packets)
	var counter WelfareActivityIssueCounter
	require.NoError(t, db.First(&counter, 1).Error)
	assert.Equal(t, int64(1), counter.NextIssueNo)
}
