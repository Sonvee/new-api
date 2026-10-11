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
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatTimestampToDate } from '@/lib/format'
import { createServerError } from '@/lib/server-error-message'

import { getAffiliateInvitees } from '../api'
import type { AffiliateInvitee } from '../types'

export function AffiliateRewardsInviteesCard() {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const columns = useMemo<ColumnDef<AffiliateInvitee>[]>(
    () => [
      {
        accessorKey: 'username',
        header: t('Username'),
        cell: ({ row }) => (
          <span className='font-medium'>{row.original.username}</span>
        ),
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'created_at',
        header: t('Registration Time'),
        cell: ({ row }) => (
          <span className='font-mono text-xs tabular-nums'>
            {formatTimestampToDate(row.original.created_at)}
          </span>
        ),
      },
      {
        accessorKey: 'affiliate_activated',
        header: t('Invitation Status'),
        cell: ({ row }) => (
          <StatusBadge
            label={
              row.original.affiliate_activated
                ? t('Activated')
                : t('Pending Activation')
            }
            variant={row.original.affiliate_activated ? 'success' : 'warning'}
            copyable={false}
          />
        ),
        meta: { mobileBadge: true },
      },
    ],
    [t]
  )

  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: [
      'affiliate-invitees',
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const result = await getAffiliateInvitees(
        pagination.pageIndex + 1,
        pagination.pageSize
      )
      if (!result.success) {
        throw createServerError(result, t('Failed to load invited users'))
      }
      return result.data ?? { items: [], total: 0, page: 1, page_size: 10 }
    },
    placeholderData: (previousData) => previousData,
  })

  const ensurePageInRange = useCallback((pageCount: number) => {
    setPagination((previous) => {
      const lastPageIndex = Math.max(0, pageCount - 1)
      if (previous.pageIndex <= lastPageIndex) return previous
      return { ...previous, pageIndex: lastPageIndex }
    })
  }, [])

  const { table } = useDataTable({
    data: data?.items ?? [],
    columns,
    getRowId: (row) => row.username,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  return (
    <Card data-card-hover='false'>
      <CardHeader className='px-4 sm:px-5'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Users className='text-primary size-4' aria-hidden='true' />
          {t('Invitation User Details')}
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 sm:px-5'>
        {isError ? (
          <ErrorState
            className='min-h-48'
            onRetry={() => void refetch()}
          />
        ) : (
          <DataTablePage
            table={table}
            columns={columns}
            isLoading={isLoading}
            isFetching={isFetching}
            emptyTitle={t('No invited users yet')}
            emptyDescription={t(
              'Users registered through your referral link will appear here.'
            )}
            skeletonKeyPrefix='affiliate-invitees-skeleton'
            fixedHeight={false}
            paginationInFooter={false}
            toolbarProps={null}
            getColumnClassName={(_, part) =>
              part === 'header'
                ? 'h-11 px-3 align-middle'
                : 'h-14 px-3 py-2 align-middle'
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
