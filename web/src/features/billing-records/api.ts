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

import type { BillingConsumptionResponse, BillingRecordQuery, WalletLedgerResponse } from './types'

function buildQuery(params: BillingRecordQuery) {
  const query = new URLSearchParams({ p: String(params.page), page_size: String(params.pageSize) })
  const optionalParams: Record<string, string | undefined> = {
    keyword: params.keyword?.trim() || undefined,
    type: params.type || undefined,
    payment_method: params.paymentMethod || undefined,
    status: params.status || undefined,
    direction: params.direction || undefined,
  }
  for (const [key, value] of Object.entries(optionalParams)) {
    if (value) query.set(key, value)
  }
  return query.toString()
}

export async function getBillingConsumptions(params: BillingRecordQuery): Promise<BillingConsumptionResponse> {
  const res = await api.get(`/api/user/billing-records/consumption?${buildQuery(params)}`)
  return res.data
}

export async function getWalletLedgers(params: BillingRecordQuery): Promise<WalletLedgerResponse> {
  const res = await api.get(`/api/user/billing-records/balance-ledger?${buildQuery(params)}`)
  return res.data
}
