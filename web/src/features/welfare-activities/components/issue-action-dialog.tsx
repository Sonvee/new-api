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

import { ConfirmDialog } from '@/components/confirm-dialog'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { formatWelfareQuota, formatWelfareTime } from '../lib/format'
import type { WelfareAdminAction } from '../types'

export function IssueActionDialog(props: {
  action: WelfareAdminAction | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale =
    toIntlLocale(i18n.resolvedLanguage || i18n.language) ?? 'en-US'
  let title = t('Delete draft')
  let description = t(
    'Delete this draft? No issue number or claim history will be affected.'
  )
  if (props.action?.kind === 'delete' && props.action.issue.status === 'scheduled') {
    title = t('Delete scheduled issue')
    description = t(
      'Delete this scheduled issue? Its issue number will be reused by the next issue.'
    )
  }
  if (props.action?.kind === 'dispatch') {
    title = t('Dispatch red packets')
    description = t(
      'Dispatch locks this configuration and assigns the next issue number. When this issue starts, the previous open issue is discarded. Discard any existing scheduled issue first.'
    )
  }
  if (props.action?.kind === 'cancel') {
    title = t('End')
    description = t(
      props.action.issue.status === 'active'
        ? 'This open issue will end immediately. Unclaimed packets will expire and users can no longer claim it.'
        : 'This scheduled issue will never open. Its issue number and history are retained and cannot be restored. The current open issue is not affected.'
    )
  }
  return (
    <ConfirmDialog
      open={props.action !== null}
      onOpenChange={props.onOpenChange}
      title={title}
      desc={description}
      isLoading={props.pending}
      destructive={props.action?.kind !== 'dispatch'}
      handleConfirm={props.onConfirm}
    >
      {props.action ? (
        <p className='text-muted-foreground text-sm'>
          {formatWelfareQuota(props.action.issue.total_quota, locale)} ·{' '}
          {formatNumber(props.action.issue.packet_count, locale)} ·{' '}
          {formatWelfareTime(props.action.issue.start_at, locale)}
        </p>
      ) : null}
    </ConfirmDialog>
  )
}
