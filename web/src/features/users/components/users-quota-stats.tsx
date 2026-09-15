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
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'
import { useSystemConfigStore } from '@/stores/system-config-store'

import type { UserQuotaStats } from '../types'

type UsersQuotaStatsProps = {
  stats?: UserQuotaStats
  isLoading: boolean
  isError: boolean
}

export function UsersQuotaStats(props: UsersQuotaStatsProps) {
  const { t } = useTranslation()
  useSystemConfigStore((state) => state.config.currency)

  const showPlaceholder = props.isLoading || props.isError || !props.stats
  const totalQuota = showPlaceholder
    ? '—'
    : formatQuota(props.stats.total_quota)
  const remainingQuota = showPlaceholder
    ? '—'
    : formatQuota(props.stats.remaining_quota)

  return (
    <div className='flex h-8 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-3 py-0 text-xs sm:text-sm'>
      <span className='text-muted-foreground whitespace-nowrap'>
        {t('Total Site Quota')}{' '}
        <span className='text-foreground tabular-nums'>{totalQuota}</span>
      </span>
      <span aria-hidden='true' className='h-4 w-px shrink-0 bg-border' />
      <span className='text-muted-foreground whitespace-nowrap'>
        {t('Remaining Site Quota')}{' '}
        <span className='text-foreground tabular-nums'>{remainingQuota}</span>
      </span>
    </div>
  )
}
