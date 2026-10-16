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
import { describe, expect, test } from 'vitest'

import type { AdminWelfareIssue } from '../../types'
import {
  welfareDraftDefaults,
  welfareDraftPayload,
  welfareDraftSchema,
} from '../draft-form'

const t = ((key: string) => key) as TFunction

const validValues = {
  totalAmount: 10,
  packetCount: 5,
  minAmount: 1,
  startTime: '2026-10-14T00:00:00',
}

describe('welfare red packet draft form', () => {
  test('defaults the minimum quota to one unit', () => {
    expect(welfareDraftDefaults().minAmount).toBe(1)
  })

  test('rejects a zero minimum quota', () => {
    const result = welfareDraftSchema(t).safeParse({
      ...validValues,
      minAmount: 0,
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some((issue) => issue.path[0] === 'minAmount')).toBe(
      true
    )
  })

  test('accepts a minimum quota up to the average quota', () => {
    const result = welfareDraftSchema(t).safeParse(validValues)

    expect(result.success).toBe(true)
  })

  test('raises legacy zero minimums to one unit when editing', () => {
    const issue = {
      min_quota: 0,
    } as AdminWelfareIssue

    expect(welfareDraftPayload(validValues, issue).min_quota).toBe(1)
  })
})
