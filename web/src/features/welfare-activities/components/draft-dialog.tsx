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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
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
import { handleServerError } from '@/lib/handle-server-error'

import { saveWelfareDraft, welfareKeys } from '../api'
import {
  welfareDraftDefaults,
  welfareDraftPayload,
  welfareDraftSchema,
  type WelfareDraftValues,
} from '../lib/draft-form'
import type { AdminWelfareIssue } from '../types'

export function DraftDialog(props: {
  issue?: AdminWelfareIssue
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const form = useForm<WelfareDraftValues>({
    resolver: zodResolver(welfareDraftSchema(t, props.issue)),
    defaultValues: welfareDraftDefaults(props.issue),
  })
  const mutation = useMutation({
    mutationFn: (values: WelfareDraftValues) =>
      saveWelfareDraft(
        welfareDraftPayload(values, props.issue),
        props.issue?.id
      ),
    retry: false,
    onSuccess: () => {
      toast.success(t('Saved successfully'))
      void queryClient.invalidateQueries({ queryKey: welfareKeys.all })
      props.onClose()
    },
    onError: (error) => handleServerError(error),
    onSettled: () => {
      inFlight.current = false
    },
  })
  const totalQuotaValue = form.watch('totalAmount')
  const packetCountValue = form.watch('packetCount')
  const averageQuota =
    typeof totalQuotaValue === 'number' &&
    Number.isSafeInteger(totalQuotaValue) &&
    totalQuotaValue > 0 &&
    Number.isSafeInteger(packetCountValue) &&
    packetCountValue > 0
      ? Math.floor(totalQuotaValue / packetCountValue)
      : undefined
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
      showCloseButton={!mutation.isPending}
      title={
        props.issue ? t('Edit red packet draft') : t('Create red packet draft')
      }
      description={t(
        'Drafts do not use an issue number. Amounts and start time are locked after dispatch.'
      )}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={props.onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='welfare-draft-form'
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('Saving...') : t('Save changes')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='welfare-draft-form'
          className='flex flex-col gap-4'
          onSubmit={form.handleSubmit((values) => {
            if (!inFlight.current) {
              inFlight.current = true
              mutation.mutate(values)
            }
          })}
        >
          <FormField
            control={form.control}
            name='totalAmount'
            render={({ field }) => {
              const quotaValue =
                typeof field.value === 'number' && Number.isFinite(field.value)
                  ? field.value
                  : 0
              return (
                <FormItem>
                  <FormLabel>{t('Total quota')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='number'
                      min={1}
                      step={1}
                      disabled={mutation.isPending}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber
                        field.onChange(Number.isNaN(value) ? '' : value)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Enter integer quota units ({{formattedQuota}})', {
                      formattedQuota: formatQuota(quotaValue),
                    })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='packetCount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Packet count')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='number'
                    min={1}
                    max={10000}
                    step={1}
                    disabled={mutation.isPending}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Between 1 and 10,000 packets')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='minAmount'
            render={({ field }) => {
              const quotaValue =
                typeof field.value === 'number' && Number.isFinite(field.value)
                  ? field.value
                  : 0
              return (
                <FormItem>
                  <FormLabel>{t('Minimum quota per packet')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='number'
                      min={1}
                      max={averageQuota}
                      step={1}
                      disabled={mutation.isPending}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber
                        field.onChange(Number.isNaN(value) ? '' : value)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Enter integer quota units ({{formattedQuota}})', {
                      formattedQuota: formatQuota(quotaValue),
                    })}
                    {averageQuota !== undefined ? (
                      <>
                        ，
                        {t('Maximum: {{formattedQuota}}', {
                          formattedQuota: formatQuota(averageQuota),
                        })}
                      </>
                    ) : null}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <FormField
            control={form.control}
            name='startTime'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Start time')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type='datetime-local'
                    step={1}
                    disabled={mutation.isPending}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'All times use Beijing time (UTC+8). A past start time opens immediately on dispatch.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
