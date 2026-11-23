/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package model

// UserQuotaStats contains the aggregate quota values for all users.
type UserQuotaStats struct {
	TotalQuota     int64 `json:"total_quota"`
	RemainingQuota int64 `json:"remaining_quota"`
}

type userQuotaAggregate struct {
	RemainingQuota int64
	UsedQuota      int64
}

// GetUserQuotaStats returns the total and remaining quota across all users.
func GetUserQuotaStats() (UserQuotaStats, error) {
	var aggregate userQuotaAggregate
	err := DB.Unscoped().Model(&User{}).
		Select("COALESCE(SUM(quota), 0) AS remaining_quota, COALESCE(SUM(used_quota), 0) AS used_quota").
		Scan(&aggregate).Error
	if err != nil {
		return UserQuotaStats{}, err
	}

	return UserQuotaStats{
		TotalQuota:     aggregate.RemainingQuota + aggregate.UsedQuota,
		RemainingQuota: aggregate.RemainingQuota,
	}, nil
}
