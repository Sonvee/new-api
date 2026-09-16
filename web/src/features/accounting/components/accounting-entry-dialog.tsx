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
import { useEffect, useMemo, type ReactElement } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { handleServerError } from '@/lib/handle-server-error'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { createAccountingEntry, updateAccountingEntry } from '../api'
import {
  ACCOUNTING_PAYMENT_METHODS,
  ACCOUNTING_SUCCESS_MESSAGES,
} from '../constants'
import {
  createAccountingEntrySchema,
  type AccountingEntryFormValues,
} from '../lib/schema'
import type {
  AccountingEntryKind,
  AccountingEntryPayload,
  AccountingEntryRecord,
} from '../types'

type AccountingEntryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: AccountingEntryKind
  currentRow?: AccountingEntryRecord
  trigger?: ReactElement
}

function getEntryFormDefaults(
  kind: AccountingEntryKind,
  currentRow?: AccountingEntryRecord
): AccountingEntryFormValues {
  return {
    paymentMethod: currentRow?.payment_method ?? '',
    amount: currentRow ? (currentRow.amount_cents / 100).toFixed(2) : '',
    userId:
      kind === 'offline_income' && currentRow?.user
        ? String(currentRow.user.id)
        : '',
    target: kind === 'expense' ? currentRow?.target ?? '' : '',
    createTime: currentRow
      ? new Date(currentRow.create_time * 1000)
      : new Date(),
  }
}

export function AccountingEntryDialog(props: AccountingEntryDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const schema = useMemo(
    () => createAccountingEntrySchema(props.kind, t),
    [props.kind, t]
  )
  const form = useForm<AccountingEntryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: getEntryFormDefaults(props.kind, props.currentRow),
  })

  useEffect(() => {
    if (props.open) {
      form.reset(getEntryFormDefaults(props.kind, props.currentRow))
    }
  }, [form, props.currentRow, props.kind, props.open])

  const mutation = useMutation({
    mutationFn: async (values: AccountingEntryFormValues) => {
      const payload: AccountingEntryPayload = {
        kind: props.kind,
        payment_method: values.paymentMethod,
        amount: values.amount.trim(),
        create_time: Math.floor(values.createTime.getTime() / 1000),
      }
      if (props.kind === 'offline_income') {
        payload.user_id = Number(values.userId)
      } else {
        payload.target = values.target.trim()
      }
      const response = props.currentRow
        ? await updateAccountingEntry(props.currentRow.id, payload)
        : await createAccountingEntry(payload)
      return requireServerSuccess(response)
    },
    onSuccess: async () => {
      toast.success(
        t(
          props.currentRow
            ? ACCOUNTING_SUCCESS_MESSAGES.UPDATED
            : ACCOUNTING_SUCCESS_MESSAGES.CREATED
        )
      )
      props.onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
    onError: (error) => {
      const message = getServerErrorMessage(error)
      if (props.kind === 'offline_income' && message === 'user does not exist') {
        form.setError('userId', { type: 'server', message: t('User does not exist') })
        return
      }
      handleServerError(error, t('Failed to save accounting entry'))
    },
  })

  const isEditing = Boolean(props.currentRow)
  let title = t('Add expense')
  if (isEditing) {
    title = t('Edit accounting entry')
  } else if (props.kind === 'offline_income') {
    title = t('Add offline income')
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      trigger={props.trigger}
      title={title}
      description={t('Enter the payment details and creation time for this accounting entry.')}
      contentClassName='sm:max-w-lg'
      footer={
        <>
          <Button type='button' variant='outline' onClick={() => props.onOpenChange(false)} disabled={mutation.isPending}>
            {t('Cancel')}
          </Button>
          <Button type='submit' form='accounting-entry-form' disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner data-icon='inline-start' /> : null}
            {isEditing ? t('Save changes') : t('Add entry')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='accounting-entry-form'
          className='grid gap-4 py-1'
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <FormField
            control={form.control}
            name='paymentMethod'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Payment method')}</FormLabel>
                <Select
                  items={ACCOUNTING_PAYMENT_METHODS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select payment method')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {ACCOUNTING_PAYMENT_METHODS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='amount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {props.kind === 'expense' ? t('Actual expense') : t('Actual payment')}
                </FormLabel>
                <FormControl>
                  <Input {...field} inputMode='decimal' placeholder='0.00' autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {props.kind === 'offline_income' ? (
            <FormField
              control={form.control}
              name='userId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('User ID')}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode='numeric' placeholder={t('Enter user ID')} autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={form.control}
              name='target'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Expense target')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('Enter expense target')} autoComplete='off' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name='createTime'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Created at')}</FormLabel>
                <FormControl>
                  <DateTimePicker value={field.value} onChange={field.onChange} placeholder={t('Select creation time')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
