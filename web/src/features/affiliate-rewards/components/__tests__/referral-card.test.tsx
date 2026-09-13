/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

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

import { formatQuota } from '@/lib/format'

import { AffiliateRewardsReferralCard } from '../affiliate-rewards-referral-card'

describe('affiliate rewards referral card', () => {
  it('shows the referral link and configured invitation rules', () => {
    render(
      <AffiliateRewardsReferralCard
        affiliateLink='https://example.com/sign-up?aff=abc123'
        config={{
          invitation_activation_threshold: 10000000,
          quota_for_invitee: 1000000,
          quota_for_inviter: 500000,
          commission_rate: 5,
        }}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Referral Program' })
    ).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Referral link' })).toHaveValue(
      'https://example.com/sign-up?aff=abc123'
    )
    expect(
      screen.getByRole('button', { name: 'Copy referral link' })
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Invitation Notes' })
    ).toBeVisible()
    const notes = screen.getByRole('list')
    expect(notes).toHaveTextContent(formatQuota(10000000))
    expect(notes).toHaveTextContent(formatQuota(1000000))
    expect(notes).toHaveTextContent(formatQuota(500000))
    expect(notes).toHaveTextContent('5%')
  })
})
