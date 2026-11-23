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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getWelfareCurrent, welfareKeys } from './api'
import { ClaimHistory } from './components/claim-history'
import { CurrentRedPacket } from './components/current-red-packet'

export function WelfareActivities() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const lastManualRefreshAt = useRef(0)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const role = useAuthStore((state) => state.auth.user?.role)
  const query = useQuery({
    queryKey: [...welfareKeys.current, userId],
    queryFn: getWelfareCurrent,
    refetchOnMount: 'always',
    retry: false,
    meta: { errorToast: false },
  })
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: welfareKeys.all })
  }, [queryClient])
  const handleManualRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastManualRefreshAt.current < 1000) return
    lastManualRefreshAt.current = now
    refresh()
  }, [refresh])
  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        {t('Welfare Activities')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN ? (
          <Button
            variant='outline'
            render={
              <Link
                to='/system-settings/site/$section'
                params={{ section: 'welfare-activities' }}
              />
            }
          >
            {t('Manage welfare activities')}
          </Button>
        ) : null}
        <Button
          variant='outline'
          disabled={query.isFetching}
          onClick={handleManualRefresh}
        >
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-6'>
          {query.isLoading ? <LoadingState /> : null}
          {query.isError ? (
            <ErrorState
              title={t('Failed to load welfare activities')}
              onRetry={refresh}
            />
          ) : null}
          {query.data ? (
            <div className='shrink-0'>
              <CurrentRedPacket
                key={userId}
                current={query.data}
                unavailable={query.isError}
              />
            </div>
          ) : null}
          <div className='min-h-0 flex-1'>
            <ClaimHistory currentIssueNo={query.data?.issue?.issue_no} />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
