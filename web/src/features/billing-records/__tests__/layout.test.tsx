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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { BillingRecordsTable } from '../components/billing-records-table'

afterEach(() => vi.restoreAllMocks())

describe('billing records toolbar', () => {
  it('uses the shared filter toolbar with column visibility and no date filters', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: { items: [], total: 0, page: 1, page_size: 10 },
      },
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <BillingRecordsTable kind='consumption' />
      </QueryClientProvider>
    )

    expect(await screen.findByRole('button', { name: 'View' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Consumption type' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Payment method' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Status' })).toBeVisible()
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('End date')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'View' }))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Bill number' })).toBeVisible()
  })
})
