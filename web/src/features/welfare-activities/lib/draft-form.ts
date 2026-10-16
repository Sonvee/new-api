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
import { z } from 'zod'

import type { AdminWelfareIssue, WelfareDraftPayload } from '../types'
import { welfareTimeInput } from './format'

const quotaInput = z.union([z.number(), z.literal('')])

const welfareDraftBaseSchema = z.object({
  totalAmount: quotaInput,
  packetCount: z.number(),
  minAmount: quotaInput,
  startTime: z.string(),
})

export function welfareDraftDefaults(issue?: AdminWelfareIssue) {
  return {
    totalAmount: issue?.total_quota ?? 500000,
    packetCount: issue?.packet_count ?? 10,
    minAmount: Math.max(issue?.min_quota ?? 1, 1),
    startTime: welfareTimeInput(
      issue?.start_at ?? Math.floor(Date.now() / 1000)
    ),
  }
}

/** 未改动的金额沿用原始整数，避免显示币种反向换算改变既有草稿额度。 */
export function welfareDraftPayload(
  values: WelfareDraftValues,
  issue?: AdminWelfareIssue
): WelfareDraftPayload {
  const original = issue ? welfareDraftDefaults(issue) : null
  return {
    total_quota:
      issue && original?.totalAmount === values.totalAmount
        ? issue.total_quota
        : Number(values.totalAmount),
    min_quota:
      issue &&
      issue.min_quota >= 1 &&
      original?.minAmount === values.minAmount
        ? issue.min_quota
        : Number(values.minAmount),
    packet_count: values.packetCount,
    // 显式 UTC+8，与浏览器所在时区无关。
    start_at: Math.floor(
      new Date(`${values.startTime}+08:00`).getTime() / 1000
    ),
  }
}

export function welfareDraftSchema(t: TFunction, issue?: AdminWelfareIssue) {
  const quotaAmount = quotaInput.refine(
    (value) => typeof value === 'number' && Number.isFinite(value) && value > 0,
    t('Enter a positive amount')
  )
  const minimumQuotaAmount = quotaInput.refine(
    (value) =>
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Number.isInteger(value) &&
      value >= 1,
    t('Enter a positive amount')
  )
  return welfareDraftBaseSchema
    .extend({
      totalAmount: quotaAmount,
      packetCount: z
        .number()
        .refine(
          (value) => Number.isInteger(value) && value >= 1 && value <= 10000,
          t('Between 1 and 10,000 packets')
        ),
      minAmount: minimumQuotaAmount,
      startTime: z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
          t('Enter a valid Beijing time')
        ),
    })
    .superRefine((values, ctx) => {
      const payload = welfareDraftPayload(values, issue)
      if (
        !Number.isSafeInteger(payload.total_quota) ||
        payload.total_quota <= 0
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['totalAmount'],
          message: t('Amount must be a positive, safe integer quota'),
        })
      }
      if (
        !Number.isSafeInteger(payload.min_quota) ||
        payload.min_quota < 1
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['minAmount'],
          message: t('Amount must be a positive, safe integer quota'),
        })
      }
      if (
        !Number.isSafeInteger(payload.start_at) ||
        payload.start_at <= 0 ||
        payload.start_at > 253402271999
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['startTime'],
          message: t('Enter a valid Beijing time'),
        })
      }
      if (
        Number.isSafeInteger(payload.total_quota) &&
        Number.isSafeInteger(payload.packet_count) &&
        payload.packet_count > 0
      ) {
        if (payload.total_quota < payload.packet_count) {
          ctx.addIssue({
            code: 'custom',
            path: ['totalAmount'],
            message: t('Total quota must be at least the packet count'),
          })
        }
        if (
          Number.isSafeInteger(payload.min_quota) &&
          payload.min_quota > Math.floor(payload.total_quota / payload.packet_count)
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['minAmount'],
            message: t('Minimum quota cannot exceed the average quota'),
          })
        }
      }
    })
}

export type WelfareDraftValues = z.infer<typeof welfareDraftBaseSchema>
