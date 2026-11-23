/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { AffiliateRewardsConfig } from '@/features/wallet/types'
import { formatQuota } from '@/lib/format'

interface AffiliateRewardsReferralCardProps {
  affiliateLink: string
  config?: AffiliateRewardsConfig
  loading?: boolean
}

export function AffiliateRewardsReferralCard(
  props: AffiliateRewardsReferralCardProps
) {
  const { t } = useTranslation()

  if (props.loading || !props.config) {
    return (
      <Card data-card-hover='false'>
        <CardHeader className='px-4 sm:px-5'>
          <Skeleton className='h-6 w-32' />
        </CardHeader>
        <CardContent className='space-y-4 px-4 sm:px-5'>
          <div className='flex flex-col gap-2 sm:flex-row'>
            <Skeleton className='h-9 flex-1 rounded-md' />
            <Skeleton className='h-9 w-28 rounded-md' />
          </div>
          <Skeleton className='h-32 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const config = props.config

  return (
    <Card data-card-hover='false'>
      <CardHeader className='px-4 sm:px-5'>
        <CardTitle
          role='heading'
          aria-level={2}
          className='flex items-center gap-2 text-base'
        >
          <Share2 className='text-primary size-4' aria-hidden='true' />
          {t('Referral Program')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 px-4 sm:px-5'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <Input
            value={props.affiliateLink}
            readOnly
            aria-label={t('Referral link')}
            className='min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={props.affiliateLink}
            variant='outline'
            size='default'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          >
            {t('Copy Link')}
          </CopyButton>
        </div>

        <div className='bg-muted/45 rounded-lg border p-3.5 sm:p-4'>
          <h3 className='text-sm font-semibold'>{t('Invitation Notes')}</h3>
          <ol className='text-muted-foreground mt-2.5 list-decimal space-y-2 pl-5 text-sm leading-relaxed'>
            <li>
              {t(
                'Registering through your referral link automatically links the new user to you.'
              )}
            </li>
            <li>
              {t(
                'An invitee becomes a valid invite when their balance first reaches {{activationThreshold}}.',
                {
                  activationThreshold: formatQuota(
                    config.invitation_activation_threshold
                  ),
                }
              )}
            </li>
            <li>
              {t(
                'After activation, the invitee receives {{inviteeReward}}, and you receive {{inviterReward}}.',
                {
                  inviteeReward: formatQuota(config.quota_for_invitee),
                  inviterReward: formatQuota(config.quota_for_inviter),
                }
              )}
            </li>
            <li>
              {t(
                "The invitee's activation top-up and all later paid top-ups earn you a {{commissionRate}} commission rebate.",
                { commissionRate: `${config.commission_rate}%` }
              )}
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
