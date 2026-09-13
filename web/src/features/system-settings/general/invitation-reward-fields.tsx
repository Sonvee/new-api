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
import type { ChangeEvent } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

type InvitationRewardFormValues = {
  QuotaForInviter: number | ''
  QuotaForInvitee: number | ''
}

type QuotaInputValue = number | ''

function formatQuotaInputValue(value: QuotaInputValue): string {
  return formatQuota(value === '' ? 0 : value)
}

function handleNumberChange(
  onChange: (value: QuotaInputValue) => void,
  event: ChangeEvent<HTMLInputElement>
) {
  const value = event.currentTarget.valueAsNumber
  onChange(Number.isNaN(value) ? '' : value)
}

/**
 * Renders the canonical inviter and invitee reward fields used by both billing settings pages.
 */
export function InvitationRewardFields() {
  const { t } = useTranslation()
  const { control } = useFormContext<InvitationRewardFormValues>()

  return (
    <>
      <FormField
        control={control}
        name='QuotaForInviter'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Inviter Reward')}</FormLabel>
            <FormControl>
              <Input
                type='number'
                value={field.value ?? ''}
                onChange={(event) => handleNumberChange(field.onChange, event)}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            </FormControl>
            <FormDescription>
              {t('Quota given to users who invite others ({{formattedQuota}})', {
                formattedQuota: formatQuotaInputValue(field.value),
              })}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='QuotaForInvitee'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Invitee Reward')}</FormLabel>
            <FormControl>
              <Input
                type='number'
                value={field.value ?? ''}
                onChange={(event) => handleNumberChange(field.onChange, event)}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            </FormControl>
            <FormDescription>
              {t('Quota given to invited users ({{formattedQuota}})', {
                formattedQuota: formatQuotaInputValue(field.value),
              })}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
