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
import type { TFunction } from 'i18next'

import { ACCOUNTING_PAYMENT_METHODS } from '../constants'
import type { AccountingFilters, AccountingTimeQuery } from '../types'

/** Format integer cents with the required RMB sign order, for example ¥-50.00. */
export function formatYuanCents(cents: number): string {
  const normalized = Number.isFinite(cents) ? Math.round(cents) : 0
  const sign = normalized < 0 ? '-' : ''
  const value = (Math.abs(normalized) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `¥${sign}${value}`
}

export function formatUsdAmount(amount: number): string {
  const normalized = Number.isFinite(amount) ? amount : 0
  const sign = normalized < 0 ? '-' : ''
  const value = Math.abs(normalized).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `$${sign}${value}`
}

export function getAccountingPaymentMethodLabel(
  method: string,
  t: TFunction
): string {
  const option = ACCOUNTING_PAYMENT_METHODS.find(
    (candidate) => candidate.value === method
  )
  return option ? t(option.labelKey) : method
}

export function getAccountingConsumptionTypeLabel(
  type: string,
  t: TFunction
): string {
  if (type === 'topup') return t('Balance top-up')
  if (type === 'subscription') return t('Subscription purchase')
  return type
}

/** Convert the applied local date range to Unix-second API parameters. */
export function getAccountingTimeQuery(
  filters: AccountingFilters
): AccountingTimeQuery {
  if (filters.range === 'all') return {}
  return {
    startTime: filters.startTime
      ? Math.floor(filters.startTime.getTime() / 1000)
      : undefined,
    endTime: filters.endTime
      ? Math.floor(filters.endTime.getTime() / 1000)
      : undefined,
  }
}
