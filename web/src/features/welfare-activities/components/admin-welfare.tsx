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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { getAdminWelfareIssues, runWelfareAction, welfareKeys } from '../api'
import { formatWelfareQuota, formatWelfareTime } from '../lib/format'
import type { AdminWelfareIssue, WelfareAdminAction } from '../types'
import { ClaimsTable } from './claims-table'
import { DraftDialog } from './draft-dialog'
import { IssueActionDialog } from './issue-action-dialog'
import { IssueDetails } from './issue-details'
import { IssueRowActions } from './issue-row-actions'
import { IssueStatus } from './issue-status'

export function AdminWelfare() {
  const { t, i18n } = useTranslation()
  const locale =
    toIntlLocale(i18n.resolvedLanguage || i18n.language) ?? 'en-US'
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [draft, setDraft] = useState<AdminWelfareIssue | 'new' | null>(null)
  const [action, setAction] = useState<WelfareAdminAction | null>(null)
  const [details, setDetails] = useState<AdminWelfareIssue | null>(null)
  const [historyIssueNo, setHistoryIssueNo] = useState<number | null>(null)
  const inFlight = useRef(false)
  const lastManualRefreshAt = useRef(0)
  const query = useQuery({
    queryKey: [...welfareKeys.admin, pagination],
    queryFn: () =>
      getAdminWelfareIssues(pagination.pageIndex + 1, pagination.pageSize),

    retry: false,
    meta: { errorToast: false },
  })
  const mutation = useMutation({
    mutationFn: (value: WelfareAdminAction) =>
      runWelfareAction(value.issue.id, value.kind),
    retry: false,
    onSuccess: () => {
      toast.success(t('Operation successful'))
      setAction(null)
      void queryClient.invalidateQueries({ queryKey: welfareKeys.all })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  const columns = useMemo<ColumnDef<AdminWelfareIssue>[]>(
    () => [
      {
        accessorKey: 'issue_no',
        header: t('Red packet issue'),
        meta: { mobileTitle: true },
        cell: ({ row }) =>
          row.original.issue_no
            ? t('Issue {{number}}', { number: row.original.issue_no })
            : t('Draft #{{id}}', { id: row.original.id }),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        meta: { mobileBadge: true },
        cell: ({ row }) => <IssueStatus status={row.original.status} />,
      },
      {
        accessorKey: 'total_quota',
        header: t('Total quota'),
        cell: ({ row }) => formatWelfareQuota(row.original.total_quota, locale),
      },
      {
        accessorKey: 'remaining_count',
        header: t('Remaining packets'),
        cell: ({ row }) =>
          `${formatNumber(row.original.remaining_count, locale)} / ${formatNumber(row.original.packet_count, locale)}`,
      },
      {
        accessorKey: 'start_at',
        header: t('Start time'),
        cell: ({ row }) => formatWelfareTime(row.original.start_at, locale),
      },
      {
        id: 'actions',
        header: t('Actions'),
        size: 320,
        cell: ({ row }) => (
          <IssueRowActions
            issue={row.original}
            pending={mutation.isPending}
            onDetails={setDetails}
            onClaims={setHistoryIssueNo}
            onEdit={setDraft}
            onAction={setAction}
          />
        ),
      },
    ],
    [t, locale, mutation.isPending]
  )
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination,
    onPaginationChange: setPagination,
    totalCount: query.data?.total ?? 0,
    manualPagination: true,
    enableSorting: false,
    getRowId: (row) => String(row.id),
    ensurePageInRange: (pageCount) => {
      if (query.isSuccess && !query.isFetching && pagination.pageIndex >= Math.max(1, pageCount)) {
        setPagination((previous) => ({ ...previous, pageIndex: Math.max(0, pageCount - 1) }))
      }
    },
  })
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
        <p className='text-muted-foreground shrink-0 text-sm'>
          {t(
            'Only one open issue and one scheduled issue are allowed. Unclaimed packets from an old issue expire when a new issue opens.'
          )}
        </p>
        <div className='flex shrink-0 flex-wrap gap-2'>
          <Button
            onClick={() => setDraft('new')}
            disabled={draft !== null}
          >
            {t('Create red packet draft')}
          </Button>
          <Button
            variant='outline'
            disabled={query.isFetching}
            onClick={() => {
              const now = Date.now()
              if (now - lastManualRefreshAt.current < 1000) return
              lastManualRefreshAt.current = now
              void query.refetch()
            }}
          >
            {t('Refresh')}
          </Button>
        </div>
        {query.isError ? (
          <ErrorState
            onRetry={() => {
              void query.refetch()
            }}
          />
        ) : (
          <DataTablePage
            table={table}
            columns={columns}
            isLoading={query.isLoading}
            isFetching={query.isFetching}
            toolbarProps={null}
            getColumnClassName={(columnId) =>
              columnId === 'actions' ? 'min-w-80' : ''
            }
            emptyTitle={t('No red packet issues yet')}
            fixedHeight
            paginationInFooter
            className='h-auto min-h-0 flex-1'
          />
        )}
        {draft ? (
          <DraftDialog
            key={draft === 'new' ? 'new' : draft.id}
            issue={draft === 'new' ? undefined : draft}
            onClose={() => {
              setDraft(null)
            }}
          />
        ) : null}
        <IssueActionDialog
          action={action}
          pending={mutation.isPending}
          onOpenChange={(open) => {
            if (!open && !mutation.isPending) setAction(null)
          }}
          onConfirm={() => {
            if (action && !inFlight.current) {
              inFlight.current = true
              mutation.mutate(action)
            }
          }}
        />
        {details ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setDetails(null)
            }}
            title={t('Red packet issue details')}
          >
            <IssueDetails issue={details} />
          </Dialog>
        ) : null}
        {historyIssueNo ? (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setHistoryIssueNo(null)
            }}
            title={t('Issue {{number}}', { number: historyIssueNo })}
            description={t('Claim records')}
            contentClassName='sm:max-w-5xl'
          >
            <ClaimsTable key={historyIssueNo} issueNo={historyIssueNo} admin />
          </Dialog>
        ) : null}
    </div>
  )
}
