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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { formatTimestampToDate } from '@/lib/format'

import { AffiliateRewardsInviteesCard } from '../affiliate-rewards-invitees-card'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('shows invited users with registration time and activation status', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: {
        items: [
          {
            username: 'activated-user',
            created_at: 1788840000,
            affiliate_activated: true,
          },
          {
            username: 'pending-user',
            created_at: 1788753600,
            affiliate_activated: false,
          },
        ],
        total: 2,
        page: 1,
        page_size: 10,
      },
    },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AffiliateRewardsInviteesCard />
    </QueryClientProvider>
  )

  expect(await screen.findByRole('cell', { name: 'activated-user' })).toBeVisible()
  expect(screen.getByRole('columnheader', { name: 'Username' })).toBeVisible()
  expect(
    screen.getByRole('columnheader', { name: 'Registration Time' })
  ).toBeVisible()
  expect(
    screen.getByRole('columnheader', { name: 'Invitation Status' })
  ).toBeVisible()
  expect(screen.getByText('Activated')).toBeVisible()
  expect(screen.getByText('Pending Activation')).toBeVisible()
  expect(screen.getByText(formatTimestampToDate(1788840000))).toBeVisible()
  expect(screen.getByText('Total:')).toBeVisible()
})

it('loads the next page when the next-page control is activated', async () => {
  const get = vi
    .spyOn(api, 'get')
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [
            {
              username: 'page-one-user',
              created_at: 1788840000,
              affiliate_activated: true,
            },
          ],
          total: 11,
          page: 1,
          page_size: 10,
        },
      },
    })
    .mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [
            {
              username: 'page-two-user',
              created_at: 1788753600,
              affiliate_activated: false,
            },
          ],
          total: 11,
          page: 2,
          page_size: 10,
        },
      },
    })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AffiliateRewardsInviteesCard />
    </QueryClientProvider>
  )

  const user = userEvent.setup()
  await screen.findByRole('cell', { name: 'page-one-user' })
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))

  await waitFor(() =>
    expect(get).toHaveBeenLastCalledWith(
      '/api/user/aff/invitees?p=2&page_size=10'
    )
  )
  expect(await screen.findByRole('cell', { name: 'page-two-user' })).toBeVisible()
})
