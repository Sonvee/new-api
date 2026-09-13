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
import { zodResolver } from '@hookform/resolvers/zod'
import type { ChangeEvent } from 'react'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'

import {
  SettingsForm,
  SettingsFormGrid,
} from '../components/settings-form-layout'
import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { InvitationRewardFields } from '../general/invitation-reward-fields'

const affiliateRewardsSchema = z.object({
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  InvitationActivationThreshold: z.coerce.number().min(0),
  CommissionRate: z.coerce.number().min(0).max(100),
})

export type AffiliateRewardsFormValues = z.infer<
  typeof affiliateRewardsSchema
>

type AffiliateRewardsSettingsSectionProps = {
  defaultValues: AffiliateRewardsFormValues
}

function handleNumberChange(
  onChange: (value: number | '') => void,
  event: ChangeEvent<HTMLInputElement>
) {
  const value = event.currentTarget.valueAsNumber
  onChange(Number.isNaN(value) ? '' : value)
}

function formatQuotaDescription(value: number | '') {
  return formatQuota(value === '' ? 0 : value)
}

export function AffiliateRewardsSettingsSection(
  props: AffiliateRewardsSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { form, handleSubmit, isDirty, isSubmitting } =
    useSettingsForm<AffiliateRewardsFormValues>({
      resolver: zodResolver(affiliateRewardsSchema) as Resolver<
        AffiliateRewardsFormValues,
        unknown,
        AffiliateRewardsFormValues
      >,
      defaultValues: props.defaultValues,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: value as string | number | boolean,
          })
        }
      },
    })

  return (
    <SettingsSection title={t('Invitation Rewards')}>
      <Form {...form}>
        <SettingsForm onSubmit={handleSubmit}>
          <SettingsPageFormActions
            onSave={handleSubmit}
            isSaving={updateOption.isPending || isSubmitting}
          />
          <FormDirtyIndicator isDirty={isDirty} />
          <SettingsFormGrid>
            <InvitationRewardFields />

            <FormField
              control={form.control}
              name='InvitationActivationThreshold'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Invitation Activation Threshold')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      value={field.value ?? ''}
                      onChange={(event) =>
                        handleNumberChange(field.onChange, event)
                      }
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'A referred user becomes valid when their current balance reaches this threshold ({{formattedQuota}}). Set to 0 to activate upon registration.',
                      {
                        formattedQuota: formatQuotaDescription(field.value),
                      }
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='CommissionRate'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Commission Rate (%)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={100}
                      step='1'
                      value={field.value ?? ''}
                      onChange={(event) =>
                        handleNumberChange(field.onChange, event)
                      }
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Commission credited to the inviter from each paid top-up after activation.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
