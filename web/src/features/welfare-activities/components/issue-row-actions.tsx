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

import { Button } from '@/components/ui/button'

import type { AdminWelfareIssue, WelfareAdminAction } from '../types'

export function IssueRowActions(props: {
  issue: AdminWelfareIssue
  pending: boolean
  onDetails: (issue: AdminWelfareIssue) => void
  onClaims: (issueNo: number) => void
  onEdit: (issue: AdminWelfareIssue) => void
  onAction: (action: WelfareAdminAction) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='flex flex-wrap gap-1 sm:w-max sm:flex-nowrap'>
      <Button
        size='sm'
        variant='ghost'
        onClick={() => props.onDetails(props.issue)}
      >
        {t('Details')}
      </Button>
      {props.issue.issue_no ? (
        <Button
          size='sm'
          variant='ghost'
          onClick={() => {
            if (props.issue.issue_no) props.onClaims(props.issue.issue_no)
          }}
        >
          {t('Claim records')}
        </Button>
      ) : null}
      {props.issue.status === 'draft' ? (
        <>
          <Button
            size='sm'
            variant='outline'
            disabled={props.pending}
            onClick={() => props.onEdit(props.issue)}
          >
            {t('Edit')}
          </Button>
          <Button
            size='sm'
            disabled={props.pending}
            onClick={() =>
              props.onAction({ issue: props.issue, kind: 'dispatch' })
            }
          >
            {t('Dispatch')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            disabled={props.pending}
            onClick={() =>
              props.onAction({ issue: props.issue, kind: 'delete' })
            }
          >
            {t('Delete')}
          </Button>
        </>
      ) : null}
      {props.issue.status === 'scheduled' ? (
        <Button
          size='sm'
          variant='ghost'
          disabled={props.pending}
          onClick={() => props.onAction({ issue: props.issue, kind: 'delete' })}
        >
          {t('Delete')}
        </Button>
      ) : null}
      {props.issue.status === 'active' ? (
        <Button
          size='sm'
          variant='outline'
          disabled={props.pending}
          onClick={() => props.onAction({ issue: props.issue, kind: 'cancel' })}
        >
          {t('End')}
        </Button>
      ) : null}    </div>
  )
}
