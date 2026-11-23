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
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { toIntlLocale } from '@/i18n/languages'

import { getWelfareClaims, welfareKeys } from '../api'
import { formatWelfareQuota, formatWelfareTime } from '../lib/format'
import type { WelfareClaim } from '../types'

export function ClaimsTable(props: {
  issueNo: number
  admin?: boolean
  fixedHeight?: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language) ?? 'en-US'
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const query = useQuery({
    queryKey: [
      ...welfareKeys.all,
      'claims',
      props.admin === true,
      props.issueNo,
      pagination,
    ],
    queryFn: () =>
      getWelfareClaims(
        props.issueNo,
        pagination.pageIndex + 1,
        pagination.pageSize,
        props.admin === true
      ),
    refetchOnMount: 'always',
    retry: false,
    meta: { errorToast: false },
  })
  const columns = useMemo<ColumnDef<WelfareClaim>[]>(() => {
    const result: ColumnDef<WelfareClaim>[] = [
      {
        accessorKey: 'username',
        header: t('Username'),
        meta: { mobileTitle: true },
      },
      {
        accessorKey: 'quota',
        header: t('Claimed quota'),
        cell: ({ row }) => formatWelfareQuota(row.original.quota, locale),
      },
      {
        accessorKey: 'created_at',
        header: t('Claimed at'),
        cell: ({ row }) => formatWelfareTime(row.original.created_at, locale),
      },
    ]
    if (props.admin) {
      result.unshift({ accessorKey: 'user_id', header: t('User ID') })
      result.push({
        accessorKey: 'ledger_no',
        header: t('Ledger number'),
        cell: ({ row }) => (
          <span className='inline-flex items-center gap-1'>
            <code>{row.original.ledger_no}</code>
            <CopyButton value={row.original.ledger_no ?? ''} size='icon' />
          </span>
        ),
      })
    }
    return result
  }, [t, locale, props.admin])
  const { table } = useDataTable({
    data: query.data?.items ?? [],
    columns,
    pagination,
    onPaginationChange: setPagination,
    totalCount: query.data?.total ?? 0,
    manualPagination: true,
    enableSorting: false,
    getRowId: (row) => String(row.id),
  })
  if (query.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }
  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      toolbarProps={null}
      emptyTitle={t('No claims yet')}
      emptyDescription={t('Successful claims will appear here.')}
      fixedHeight={props.fixedHeight === true}
      paginationInFooter={props.fixedHeight === true}
    />
  )
}
