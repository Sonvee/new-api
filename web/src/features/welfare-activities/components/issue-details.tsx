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

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { formatWelfareQuota, formatWelfareTime } from '../lib/format'
import type { AdminWelfareIssue } from '../types'
import { IssueStatus } from './issue-status'

export function IssueDetails(props: { issue: AdminWelfareIssue }) {
  const { t, i18n } = useTranslation()
  const locale =
    toIntlLocale(i18n.resolvedLanguage || i18n.language) ?? 'en-US'
  const issue = props.issue
  const items = [
    [t('Total quota'), formatWelfareQuota(issue.total_quota, locale)],
    [t('Packet count'), formatNumber(issue.packet_count, locale)],
    [
      t('Minimum quota per packet'),
      formatWelfareQuota(issue.min_quota, locale),
    ],
    [t('Remaining quota'), formatWelfareQuota(issue.remaining_quota, locale)],
    [t('Remaining packets'), formatNumber(issue.remaining_count, locale)],
    [t('Start time'), formatWelfareTime(issue.start_at, locale)],
    [t('Created by'), issue.created_by || '-'],
    [t('Created at'), formatWelfareTime(issue.created_at, locale)],
    [t('Dispatched by'), issue.dispatched_by || '-'],
    [t('Dispatched at'), formatWelfareTime(issue.dispatched_at, locale)],
    [t('Ended by'), issue.cancelled_by || '-'],
    [t('Ended at'), formatWelfareTime(issue.cancelled_at, locale)],
  ]
  let reason = '-'
  if (issue.cancel_reason === 'replaced by a new issue') {
    reason = t('Replaced by a new issue')
  }
  if (issue.cancel_reason === 'replaced by a scheduled issue') {
    reason = t('Replaced by a scheduled issue')
  }
  if (issue.cancel_reason === 'cancelled by administrator') {
    reason = t('Ended by administrator')
  }
  return (
    <div className='flex flex-col gap-4'>
      <IssueStatus status={issue.status} />
      <dl className='flex flex-col gap-3 text-sm'>
        {items.map(([label, value]) => (
          <div key={label} className='flex flex-wrap justify-between gap-2'>
            <dt className='text-muted-foreground'>{label}</dt>
            <dd className='font-medium'>{value}</dd>
          </div>
        ))}
        <div className='flex flex-wrap justify-between gap-2'>
          <dt className='text-muted-foreground'>{t('End reason')}</dt>
          <dd>{reason}</dd>
        </div>
      </dl>
    </div>
  )
}
