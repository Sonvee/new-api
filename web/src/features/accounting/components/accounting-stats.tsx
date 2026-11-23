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
import {
  BadgeDollarSign,
  CircleDollarSign,
  HandCoins,
  Landmark,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { formatUsdAmount, formatYuanCents } from '../lib/format'
import type { AccountingStats, AccountingTimeRange } from '../types'

type AccountingStatsCardsProps = {
  stats?: AccountingStats
  remainingQuota?: number
  range: AccountingTimeRange
  isLoading: boolean
}

export function AccountingStatsCards(props: AccountingStatsCardsProps) {
  const { t } = useTranslation()
  const currency = useSystemConfigStore((state) => state.config.currency)
  const quotaPerUnit = currency.quotaPerUnit > 0 ? currency.quotaPerUnit : 500000
  const remainingUsd = props.remainingQuota == null
    ? undefined
    : props.remainingQuota / quotaPerUnit
  const netProfitCents =
    props.range === 'all' && props.stats && remainingUsd != null
      ? props.stats.gross_profit_cents - Math.round(remainingUsd * 100)
      : undefined
  let netProfitValue = '-'
  if (props.range === 'all') {
    netProfitValue = netProfitCents == null ? '—' : formatYuanCents(netProfitCents)
  }

  const items: Array<{
    label: string
    description: string
    value: string
    icon: typeof CircleDollarSign
    tone: IconBadgeTone
  }> = [
    {
      label: t('Total income'),
      description: t('Online plus offline income'),
      value: props.stats ? formatYuanCents(props.stats.total_income_cents) : '—',
      icon: CircleDollarSign,
      tone: 'success',
    },
    {
      label: t('Online income'),
      description: t('Successful online payments'),
      value: props.stats ? formatYuanCents(props.stats.online_income_cents) : '—',
      icon: Landmark,
      tone: 'info',
    },
    {
      label: t('Offline income'),
      description: t('Manually recorded offline payments'),
      value: props.stats ? formatYuanCents(props.stats.offline_income_cents) : '—',
      icon: HandCoins,
      tone: 'chart-4',
    },
    {
      label: t('Total expense'),
      description: t('Manually recorded expenses'),
      value: props.stats ? formatYuanCents(props.stats.total_expense_cents) : '—',
      icon: TrendingDown,
      tone: 'destructive',
    },
    {
      label: t('Gross profit'),
      description: t('Total income minus total expense'),
      value: props.stats ? formatYuanCents(props.stats.gross_profit_cents) : '—',
      icon: TrendingUp,
      tone: 'warning',
    },
    {
      label: t('Net profit'),
      description: t('Gross profit minus remaining site quota'),
      value: netProfitValue,
      icon: BadgeDollarSign,
      tone: 'chart-2',
    },
    {
      label: t('Remaining site quota'),
      description: t('Current quota across all users'),
      value: remainingUsd == null ? '—' : formatUsdAmount(remainingUsd),
      icon: PiggyBank,
      tone: 'neutral',
    },
  ]

  return (
    <div className='grid grid-cols-2 overflow-hidden rounded-lg border md:grid-cols-4 xl:grid-cols-7'>
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'min-w-0 px-2.5 py-2.5 sm:px-5 sm:py-4 xl:border-t-0',
            index >= 2 && 'border-t',
            index % 2 === 1 && 'border-l',
            index < 4 ? 'md:border-t-0' : 'md:border-t',
            index % 4 === 0 ? 'md:border-l-0' : 'md:border-l',
            index === 0 ? 'xl:border-l-0' : 'xl:border-l'
          )}
        >
          <div className='flex items-center gap-1.5 sm:gap-2.5'>
            <IconBadge tone={item.tone} size='stat'>
              <item.icon />
            </IconBadge>
            <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase sm:text-xs'>
              {item.label}
            </div>
          </div>
          {props.isLoading ? (
            <Skeleton className='mt-2 h-6 w-full sm:mt-2.5 sm:h-7' />
          ) : (
            <div className='text-foreground mt-1.5 font-mono text-sm font-bold tracking-tight break-all tabular-nums sm:mt-2.5 sm:text-2xl'>
              {item.value}
            </div>
          )}
          <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
            {item.description}
          </div>
        </div>
      ))}
    </div>
  )
}
