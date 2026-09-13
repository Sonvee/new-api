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
  Gift,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '@/features/wallet/types'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

interface AffiliateRewardsStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function AffiliateRewardsStatsCard(
  props: AffiliateRewardsStatsCardProps
) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='grid grid-cols-2 overflow-hidden rounded-xl border lg:grid-cols-4'>
        {['invites', 'valid-invites', 'rewards', 'commission'].map((key) => (
          <div
            key={key}
            className={cn(
              'min-w-0 px-3 py-3 sm:px-5 sm:py-4',
              key === 'invites' && 'border-r border-b',
              key === 'valid-invites' && 'border-b',
              key === 'rewards' && 'border-r',
              'lg:border-r lg:border-b-0',
              key === 'commission' && 'lg:border-r-0'
            )}
          >
            <Skeleton className='h-3.5 w-24' />
            <Skeleton className='mt-2.5 h-7 w-28' />
            <Skeleton className='mt-2 hidden h-3.5 w-40 md:block' />
          </div>
        ))}
      </div>
    )
  }

  const stats: {
    label: string
    value: string
    description: string
    icon: LucideIcon
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Total Invites'),
      value: (props.user?.aff_count ?? 0).toLocaleString(),
      description: t('Users registered through your referral link'),
      icon: Users,
      tone: 'info',
    },
    {
      label: t('Valid Invites'),
      value: (props.user?.aff_valid_count ?? 0).toLocaleString(),
      description: t('Invited users who reached the activation threshold'),
      icon: UserCheck,
      tone: 'success',
    },
    {
      label: t('Invitation Rewards'),
      value: formatQuota(props.user?.aff_reward_quota ?? 0),
      description: t('Fixed invitation rewards credited to your balance'),
      icon: Gift,
      tone: 'chart-3',
    },
    {
      label: t('Commission Rebates'),
      value: formatQuota(props.user?.aff_commission_quota ?? 0),
      description: t('Commission credited from paid top-ups'),
      icon: BadgeDollarSign,
      tone: 'chart-4',
    },
  ]

  return (
    <div className='bg-card/50 grid grid-cols-2 overflow-hidden rounded-xl border lg:grid-cols-4'>
      {stats.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'min-w-0 px-3 py-3 sm:px-5 sm:py-4',
            index % 2 === 0 && 'border-r',
            index < 2 && 'border-b',
            'lg:border-r lg:border-b-0',
            index === stats.length - 1 && 'lg:border-r-0'
          )}
        >
          <div className='flex items-center gap-1.5 sm:gap-2.5'>
            <IconBadge tone={item.tone} size='stat'>
              <item.icon />
            </IconBadge>
            <div className='text-muted-foreground min-w-0 truncate text-[11px] font-medium tracking-wider uppercase sm:text-xs'>
              {item.label}
            </div>
          </div>
          <div className='text-foreground mt-2 font-mono text-lg font-bold tracking-tight break-all tabular-nums sm:mt-2.5 sm:text-2xl'>
            {item.value}
          </div>
          <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
            {item.description}
          </div>
        </div>
      ))}
    </div>
  )
}
