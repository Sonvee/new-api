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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { getSelf } from '@/lib/api'

import { useAffiliate } from '../wallet/hooks'
import type { UserWalletData } from '../wallet/types'
import { AffiliateRewardsInviteesCard } from './components/affiliate-rewards-invitees-card'
import { AffiliateRewardsReferralCard } from './components/affiliate-rewards-referral-card'
import { AffiliateRewardsStatsCard } from './components/affiliate-rewards-stats-card'

export function AffiliateRewards() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const { affiliateLink, loading: affiliateLoading } = useAffiliate()

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      setLoadError(false)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch {
      setLoadError(true)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchUser()
  }, [fetchUser])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Invitation Rewards')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          {loadError ? (
            <ErrorState onRetry={() => void fetchUser()} />
          ) : (
            <>
              <AffiliateRewardsStatsCard user={user} loading={userLoading} />
              <AffiliateRewardsReferralCard
                affiliateLink={affiliateLink}
                config={user?.affiliate_rewards_config}
                loading={affiliateLoading || userLoading}
              />
              <AffiliateRewardsInviteesCard />
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
