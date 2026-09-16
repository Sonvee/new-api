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
import type {
  AccountingFilters,
  AccountingTimeGranularity,
  AccountingTimeRange,
} from './types'

export const DEFAULT_ACCOUNTING_FILTERS: AccountingFilters = {
  range: 'all',
  granularity: 'day',
}

export const ACCOUNTING_TIME_RANGES: Array<{
  value: AccountingTimeRange
  labelKey: string
}> = [
  { value: 'all', labelKey: 'All' },
  { value: 'day', labelKey: '1 Day' },
  { value: 'week', labelKey: '1 Week' },
  { value: 'month', labelKey: '1 Month' },
]

export const ACCOUNTING_GRANULARITIES: Array<{
  value: AccountingTimeGranularity
  labelKey: string
}> = [
  { value: 'day', labelKey: 'By day' },
  { value: 'week', labelKey: 'By week' },
  { value: 'month', labelKey: 'By month' },
]

export const ACCOUNTING_PAYMENT_METHODS = [
  { value: 'wxpay', labelKey: 'WeChat Pay' },
  { value: 'alipay', labelKey: 'Alipay' },
  { value: 'stripe', labelKey: 'Stripe' },
  { value: 'creem', labelKey: 'Creem' },
  { value: 'waffo', labelKey: 'Waffo' },
  { value: 'waffo_pancake', labelKey: 'Waffo Pancake' },
] as const

export const ACCOUNTING_SUCCESS_MESSAGES = {
  CREATED: 'Accounting entry created',
  UPDATED: 'Accounting entry updated',
  DELETED: 'Accounting entry deleted',
} as const
