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
import { z } from 'zod'

import type { AccountingEntryKind } from '../types'

const amountPattern = /^\d+(?:\.\d{1,2})?$/
const positiveIntegerPattern = /^[1-9]\d*$/

export function createAccountingEntrySchema(
  kind: AccountingEntryKind,
  t: (key: string) => string
) {
  return z
    .object({
      paymentMethod: z.string().min(1, t('Payment method is required')),
      amount: z
        .string()
        .trim()
        .min(1, t('Amount is required'))
        .refine((value) => amountPattern.test(value), {
          message: t('Amount must have at most two decimal places'),
        })
        .refine((value) => {
          const amount = Number(value)
          return amount > 0 && amount <= 999_999_999.99
        }, {
          message: t('Amount must be between 0.01 and 999999999.99'),
        }),
      userId: z.string().trim(),
      target: z.string().trim().max(255, t('Expense target must not exceed 255 characters')),
      createTime: z.date(),
    })
    .superRefine((value, context) => {
      if (kind === 'offline_income' && !positiveIntegerPattern.test(value.userId)) {
        context.addIssue({
          code: 'custom',
          path: ['userId'],
          message: t('Enter a valid user ID'),
        })
      }
      if (kind === 'expense' && !value.target) {
        context.addIssue({
          code: 'custom',
          path: ['target'],
          message: t('Expense target is required'),
        })
      }
    })
}

export type AccountingEntryFormValues = z.infer<
  ReturnType<typeof createAccountingEntrySchema>
>
