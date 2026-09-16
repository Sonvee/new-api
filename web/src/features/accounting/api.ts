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
import { api } from '@/lib/api'

import type {
  AccountingEntriesResponse,
  AccountingEntryPayload,
  AccountingListQuery,
  AccountingOnlineIncomeResponse,
  AccountingStatsResponse,
  AccountingTimeQuery,
  ApiResponse,
  AccountingEntryRecord,
} from './types'

function buildTimeParams(query: AccountingTimeQuery) {
  return {
    start_time: query.startTime,
    end_time: query.endTime,
  }
}

export async function getAccountingOnlineIncome(
  query: AccountingListQuery
): Promise<AccountingOnlineIncomeResponse> {
  const response = await api.get('/api/accounting/online-income', {
    params: {
      p: query.page,
      page_size: query.pageSize,
      ...buildTimeParams(query),
    },
  })
  return response.data
}

export async function getAccountingEntries(
  query: AccountingListQuery
): Promise<AccountingEntriesResponse> {
  const response = await api.get('/api/accounting/entries', {
    params: {
      p: query.page,
      page_size: query.pageSize,
      kind: query.kind,
      ...buildTimeParams(query),
    },
  })
  return response.data
}

export async function getAccountingStats(
  query: AccountingTimeQuery
): Promise<AccountingStatsResponse> {
  const response = await api.get('/api/accounting/stats', {
    params: buildTimeParams(query),
  })
  return response.data
}

export async function createAccountingEntry(
  payload: AccountingEntryPayload
): Promise<ApiResponse<AccountingEntryRecord>> {
  const response = await api.post('/api/accounting/entries', payload)
  return response.data
}

export async function updateAccountingEntry(
  id: number,
  payload: AccountingEntryPayload
): Promise<ApiResponse<AccountingEntryRecord>> {
  const response = await api.put(`/api/accounting/entries/${id}`, payload)
  return response.data
}

export async function deleteAccountingEntry(
  id: number
): Promise<ApiResponse> {
  const response = await api.delete(`/api/accounting/entries/${id}`)
  return response.data
}
