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
import { Calendar, Filter, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { getRollingDateRange } from '@/lib/time'
import { cn } from '@/lib/utils'

import {
  ACCOUNTING_GRANULARITIES,
  ACCOUNTING_TIME_RANGES,
  DEFAULT_ACCOUNTING_FILTERS,
} from '../constants'
import type {
  AccountingFilters,
  AccountingTimeGranularity,
  AccountingTimeRange,
} from '../types'

type AccountingFilterDialogProps = {
  filters: AccountingFilters
  onApply: (filters: AccountingFilters) => void
}

function getQuickRange(range: AccountingTimeRange): Pick<AccountingFilters, 'range' | 'startTime' | 'endTime'> {
  if (range === 'all') return { range, startTime: undefined, endTime: undefined }
  let durationDays = 30
  if (range === 'day') durationDays = 1
  if (range === 'week') durationDays = 7
  const { start, end } = getRollingDateRange(durationDays)
  return { range, startTime: start, endTime: end }
}

export function AccountingFilterDialog(props: AccountingFilterDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AccountingFilters>(props.filters)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(props.filters)
    setOpen(nextOpen)
  }

  const handleQuickRange = (range: AccountingTimeRange) => {
    setDraft((current) => ({ ...current, ...getQuickRange(range) }))
  }

  const handleApply = () => {
    if (draft.range === 'custom' && (!draft.startTime || !draft.endTime)) {
      toast.error(t('Select both start and end time'))
      return
    }
    if (draft.startTime && draft.endTime && draft.startTime > draft.endTime) {
      toast.error(t('Start time must not be later than end time'))
      return
    }
    props.onApply(draft)
    setOpen(false)
  }

  const handleReset = () => {
    setDraft(DEFAULT_ACCOUNTING_FILTERS)
    props.onApply(DEFAULT_ACCOUNTING_FILTERS)
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant='outline'>
          <Filter data-icon='inline-start' />
          {t('Filter')}
        </Button>
      }
      title={t('Accounting filters')}
      description={t('Filter accounting data by time range and configure chart granularity.')}
      contentClassName='sm:max-w-lg'
      footer={
        <>
          <Button type='button' variant='outline' onClick={handleReset}>
            <RotateCcw data-icon='inline-start' />
            {t('Reset')}
          </Button>
          <Button type='button' onClick={handleApply}>
            <Search data-icon='inline-start' />
            {t('Apply Filters')}
          </Button>
        </>
      }
    >
      <div className='grid gap-4 py-1'>
        <div className='grid gap-2'>
          <Label className='flex items-center gap-2'>
            <Calendar className='size-4' aria-hidden='true' />
            {t('Quick Range')}
          </Label>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {ACCOUNTING_TIME_RANGES.map((option) => (
              <Button
                key={option.value}
                type='button'
                size='sm'
                variant={draft.range === option.value ? 'default' : 'outline'}
                aria-pressed={draft.range === option.value}
                onClick={() => handleQuickRange(option.value)}
                className={cn(draft.range === option.value && 'ring-ring ring-2 ring-offset-2')}
              >
                {t(option.labelKey)}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        <div className='grid gap-3'>
          <div className='grid gap-2'>
            <Label>{t('Start Time')}</Label>
            <DateTimePicker
              value={draft.startTime}
              onChange={(value) => setDraft((current) => ({ ...current, range: 'custom', startTime: value }))}
              placeholder={t('Select start time')}
            />
          </div>
          <div className='grid gap-2'>
            <Label>{t('End Time')}</Label>
            <DateTimePicker
              value={draft.endTime}
              onChange={(value) => setDraft((current) => ({ ...current, range: 'custom', endTime: value }))}
              placeholder={t('Select end time')}
            />
          </div>
        </div>

        <Separator />

        <div className='grid gap-2'>
          <Label>{t('Time Granularity')}</Label>
          <Select
            items={ACCOUNTING_GRANULARITIES.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            value={draft.granularity}
            onValueChange={(value) => setDraft((current) => ({ ...current, granularity: value as AccountingTimeGranularity }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('Select time granularity')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {ACCOUNTING_GRANULARITIES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Dialog>
  )
}
