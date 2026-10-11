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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { UserWalletData } from '@/features/wallet/types'
import { formatQuota } from '@/lib/format'

import { AffiliateRewardsStatsCard } from '../affiliate-rewards-stats-card'

const user: UserWalletData = {
  id: 1,
  username: 'alice',
  quota: 0,
  used_quota: 0,
  request_count: 0,
  aff_quota: 0,
  aff_history_quota: 750000,
  aff_reward_quota: 500000,
  aff_commission_quota: 250000,
  aff_count: 12,
  aff_valid_count: 5,
  affiliate_rewards_config: {
    quota_for_inviter: 1000000,
    quota_for_invitee: 2000000,
    invitation_activation_threshold: 10000000,
    commission_rate: 5,
  },
  group: 'default',
}

describe('affiliate rewards stats card', () => {
  it('shows invitation counts and separated credited amounts', () => {
    render(<AffiliateRewardsStatsCard user={user} />)

    expect(screen.getByText('Total Invites')).toBeVisible()
    expect(screen.getByText('Valid Invites')).toBeVisible()
    expect(screen.getByText('Invitation Rewards')).toBeVisible()
    expect(screen.getByText('Commission Rebates')).toBeVisible()
    expect(screen.getByText('Commission Rate')).toBeVisible()
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText('5')).toBeVisible()
    expect(screen.getByText('5%')).toBeVisible()
    expect(screen.getByText(formatQuota(user.aff_reward_quota))).toBeVisible()
    expect(
      screen.getByText(formatQuota(user.aff_commission_quota))
    ).toBeVisible()
  })
})
