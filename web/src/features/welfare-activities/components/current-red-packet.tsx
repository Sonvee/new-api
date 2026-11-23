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

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { useRedPacketClaim } from '../hooks/use-red-packet-claim'
import { useWelfareCountdown } from '../hooks/use-welfare-countdown'
import { formatWelfareQuota, formatWelfareTime } from '../lib/format'
import type { WelfareCurrent } from '../types'
import { IssueStatus } from './issue-status'

export function CurrentRedPacket(props: {
  current: WelfareCurrent
  unavailable: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale =
    toIntlLocale(i18n.resolvedLanguage || i18n.language) ?? 'en-US'
  const { mutation, claimIssue } = useRedPacketClaim()
  const { deadline, remainingSeconds } = useWelfareCountdown(props.current)
  const countdown = [
    Math.floor(remainingSeconds / 3600),
    Math.floor((remainingSeconds % 3600) / 60),
    remainingSeconds % 60,
  ]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
  // 到点可提交预约期号，领取接口会原子激活；不向旧期再发领取请求。
  const replacementDue =
    props.current.upcoming !== null && remainingSeconds === 0
  const issue = replacementDue ? props.current.upcoming : props.current.issue
  const successfulClaim = mutation.data?.claim
  const claim =
    issue?.claim ??
    (successfulClaim?.issue_no === issue?.issue_no
      ? successfulClaim
      : undefined)
  const canClaim =
    !!issue?.issue_no &&
    issue.remaining_count > 0 &&
    issue.remaining_quota > 0 &&
    !claim &&
    !props.unavailable &&
    (issue.status === 'active' ||
      (issue.status === 'scheduled' && remainingSeconds === 0))
  let buttonLabel = t('Claim red packet')
  if (issue?.status === 'finished') buttonLabel = t('Ended')
  else if (claim) buttonLabel = t('Already claimed')
  else if (issue && issue.remaining_count <= 0) buttonLabel = t('All claimed')
  if (mutation.isPending) buttonLabel = t('Claiming...')

  return (
    <Card data-card-hover='false'>
      <CardHeader>
        {issue ? (
          <div className='flex flex-wrap items-center gap-3'>
            <CardTitle>
              {t('Lucky red packet - Issue {{number}}', {
                number: issue.issue_no,
              })}
            </CardTitle>
            <IssueStatus
              status={
                issue.status === 'scheduled' && remainingSeconds === 0
                  ? 'active'
                  : issue.status
              }
            />
          </div>
        ) : (
          <CardTitle>{t('Lucky red packet')}</CardTitle>
        )}
        <CardDescription>
          {t(
            'Each user can claim once per issue. Rewards are credited to your API balance.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        {issue ? (
          <>
            <dl className='flex flex-wrap gap-x-8 gap-y-3 text-sm'>
              <div>
                <dt className='text-muted-foreground'>{t('Total quota')}</dt>
                <dd className='font-medium'>
                  {formatWelfareQuota(issue.total_quota, locale)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Remaining quota')}
                </dt>
                <dd>{formatWelfareQuota(issue.remaining_quota, locale)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>
                  {t('Remaining packets')}
                </dt>
                <dd>
                  {formatNumber(issue.remaining_count, locale)} /{' '}
                  {formatNumber(issue.packet_count, locale)}
                </dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('Start time')}</dt>
                <dd>{formatWelfareTime(issue.start_at, locale)}</dd>
              </div>
              {claim ? (
                <>
                  <div>
                    <dt className='text-muted-foreground'>
                      {t('Claimed quota')}
                    </dt>
                    <dd role='status' className='text-primary font-medium'>
                      {formatWelfareQuota(claim.quota, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className='text-muted-foreground'>{t('Claimed at')}</dt>
                    <dd>{formatWelfareTime(claim.created_at, locale)}</dd>
                  </div>
                </>
              ) : null}
              {deadline ? (
                <div>
                  <dt className='text-muted-foreground'>
                    {props.current.issue?.status === 'active' &&
                    props.current.upcoming
                      ? t('Next issue countdown')
                      : t('Countdown')}
                  </dt>
                  <dd className='tabular-nums whitespace-nowrap'>
                    {countdown}
                  </dd>
                </div>
              ) : null}
            </dl>
            <Button
              className='w-full sm:w-auto sm:self-start'
              disabled={!canClaim || mutation.isPending}
              onClick={() => {
                if (issue.issue_no) claimIssue(issue.issue_no)
              }}
            >
              {buttonLabel}
            </Button>
          </>
        ) : (
          <>
            <EmptyState
              title={t('No red packet available')}
              description={t(
                'Please wait for the next issue. Historical claims remain available below.'
              )}
              className='min-h-32'
            />
            <Button disabled className='w-full sm:w-auto sm:self-start'>
              {t('Claim red packet')}
            </Button>

          </>
        )}
        {mutation.isError && mutation.variables ? (
          <div className='flex flex-wrap items-center gap-3'>
            <p className='text-muted-foreground text-sm'>
              {t(
                'No confirmed result. Retry the same issue to recover a successful claim without claiming twice.'
              )}
            </p>
            <Button
              variant='outline'
              disabled={mutation.isPending}
              onClick={() => {
                if (mutation.variables) claimIssue(mutation.variables)
              }}
            >
              {t('Retry issue {{number}}', { number: mutation.variables })}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
