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
export type AccountingTab =
  | 'online_income'
  | 'offline_income'
  | 'expense'
  | 'analytics'

export type AccountingEntryKind = 'offline_income' | 'expense'
export type AccountingTimeRange = 'all' | 'day' | 'week' | 'month' | 'custom'
export type AccountingTimeGranularity = 'hour' | 'day' | 'week'

export interface ApiResponse<T = unknown> {
  success?: boolean
  message?: string
  data?: T
}

export interface AccountingPage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface AccountingUserSummary {
  id: number
  name: string
}

export interface AccountingOnlineIncomeRecord {
  id: number
  bill_no: string
  type: 'topup' | 'subscription'
  payment_method: string
  amount_cents: number
  user: AccountingUserSummary
  create_time: number
}

export interface AccountingEntryRecord {
  id: number
  kind: AccountingEntryKind
  payment_method: string
  amount_cents: number
  user?: AccountingUserSummary
  target: string
  create_time: number
}

export interface AccountingStats {
  online_income_cents: number
  offline_income_cents: number
  total_income_cents: number
  total_expense_cents: number
  gross_profit_cents: number
}

export interface AccountingFilters {
  range: AccountingTimeRange
  startTime?: Date
  endTime?: Date
  granularity: AccountingTimeGranularity
}

export interface AccountingTimeQuery {
  startTime?: number
  endTime?: number
}

export interface AccountingListQuery extends AccountingTimeQuery {
  page: number
  pageSize: number
  kind?: AccountingEntryKind
}

export interface AccountingEntryPayload {
  kind: AccountingEntryKind
  payment_method: string
  amount: string
  user_id?: number
  target?: string
  create_time: number
}

export type AccountingOnlineIncomeResponse = ApiResponse<
  AccountingPage<AccountingOnlineIncomeRecord>
>
export type AccountingEntriesResponse = ApiResponse<
  AccountingPage<AccountingEntryRecord>
>
export type AccountingStatsResponse = ApiResponse<AccountingStats>

export type AccountingChartType = 'bar' | 'area'

/** 服务端日历桶的开始日期，直接展示，不按浏览器时区二次转换。 */
export interface AccountingTrendPoint {
  time: string
  total_income_cents: number
  total_expense_cents: number
  gross_profit_cents: number
}

export interface AccountingTrend {
  granularity: AccountingTimeGranularity
  items: AccountingTrendPoint[]
}

export interface AccountingTrendQuery extends AccountingTimeQuery {
  granularity: AccountingTimeGranularity
}

export type AccountingTrendResponse = ApiResponse<AccountingTrend>
