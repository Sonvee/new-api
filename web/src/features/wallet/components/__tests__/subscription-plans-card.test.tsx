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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SelfSubscriptionData, UserSubscriptionRecord } from '@/features/subscriptions/types'

import { SubscriptionPlansCard } from '../subscription-plans-card'

const apiMocks = vi.hoisted(() => ({
  cleanupSelfSubscriptions: vi.fn(),
  getPublicPlans: vi.fn(),
  getSelfSubscriptionFull: vi.fn(),
  moveSelfSubscription: vi.fn(),
  updateBillingPreference: vi.fn(),
}))

vi.mock('@/features/subscriptions/api', () => apiMocks)
vi.mock('@/features/subscriptions/components/dialogs/subscription-purchase-dialog', () => ({
  SubscriptionPurchaseDialog: () => null,
}))

function makeSubscription(
  id: number,
  sortOrder: number,
  status = 'active',
  endTime = Math.floor(Date.now() / 1000) + 3600
): UserSubscriptionRecord {
  return {
    subscription: {
      id,
      user_id: 1,
      plan_id: id,
      status,
      start_time: endTime - 3600,
      end_time: endTime,
      amount_total: 100,
      amount_used: 10,
      sort_order: sortOrder,
    },
  }
}

function makeResponse(subscriptions: UserSubscriptionRecord[]): {
  success: true
  data: SelfSubscriptionData
} {
  return {
    success: true,
    data: {
      billing_preference: 'subscription_first',
      subscriptions: subscriptions.filter(
        ({ subscription }) =>
          subscription.status === 'active' &&
          subscription.end_time > Math.floor(Date.now() / 1000)
      ),
      all_subscriptions: subscriptions,
    },
  }
}

function renderCard(): void {
  render(<SubscriptionPlansCard topupInfo={null} />)
}

describe('subscription plans card subscription management', () => {
  beforeEach(() => {
    apiMocks.getPublicPlans.mockResolvedValue({ success: true, data: [] })
    apiMocks.updateBillingPreference.mockResolvedValue({ success: true, data: {} })
    apiMocks.cleanupSelfSubscriptions.mockResolvedValue({
      success: true,
      data: { deleted_count: 1 },
    })
    apiMocks.moveSelfSubscription.mockResolvedValue({ success: true })
  })

  it('disables cleanup when every subscription is still valid', async () => {
    const subscription = makeSubscription(1, 1)
    apiMocks.getSelfSubscriptionFull.mockResolvedValue(makeResponse([subscription]))

    renderCard()

    expect(
      await screen.findByRole('button', { name: 'Clean up invalid subscriptions' })
    ).toBeDisabled()
  })

  it('requires confirmation before cleaning invalid subscriptions', async () => {
    const invalid = makeSubscription(1, 2, 'expired', Math.floor(Date.now() / 1000) - 1)
    const valid = makeSubscription(2, 1)
    apiMocks.getSelfSubscriptionFull
      .mockResolvedValueOnce(makeResponse([invalid, valid]))
      .mockResolvedValueOnce(makeResponse([valid]))

    renderCard()

    const cleanupButton = await screen.findByRole('button', {
      name: 'Clean up invalid subscriptions',
    })
    expect(cleanupButton).toBeEnabled()
    await userEvent.click(cleanupButton)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(apiMocks.cleanupSelfSubscriptions).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Clean up' }))
    await waitFor(() =>
      expect(apiMocks.cleanupSelfSubscriptions).toHaveBeenCalledTimes(1)
    )
    await waitFor(() => expect(cleanupButton).toBeDisabled())
  })

  it('disables the first up button and last down button while moving adjacent subscriptions', async () => {
    const first = makeSubscription(1, 2)
    const last = makeSubscription(2, 1)
    apiMocks.getSelfSubscriptionFull
      .mockResolvedValueOnce(makeResponse([first, last]))
      .mockResolvedValueOnce(makeResponse([last, first]))

    renderCard()

    const upButtons = await screen.findAllByRole('button', {
      name: 'Move subscription up',
    })
    const downButtons = screen.getAllByRole('button', {
      name: 'Move subscription down',
    })
    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[1]).toBeDisabled()
    expect(downButtons[0]).toBeEnabled()
    expect(upButtons[1]).toBeEnabled()

    await userEvent.click(downButtons[0])
    await waitFor(() =>
      expect(apiMocks.moveSelfSubscription).toHaveBeenCalledWith(1, 'down')
    )
    await waitFor(() => expect(upButtons[0]).toBeEnabled())
  })
})
