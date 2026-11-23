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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getAccountingEntries, getAccountingOnlineIncome } from '../api'
import {
  formatYuanCents,
  getAccountingConsumptionTypeLabel,
  getAccountingPaymentMethodLabel,
} from '../lib/format'
import type {
  AccountingEntryKind,
  AccountingEntryRecord,
  AccountingOnlineIncomeRecord,
  AccountingTimeQuery,
} from '../types'
import { AccountingRowActions } from './accounting-row-actions'

type AccountingTableProps = {
  kind: 'online_income' | AccountingEntryKind
  timeQuery: AccountingTimeQuery
  onEdit: (row: AccountingEntryRecord) => void
  onDelete: (row: AccountingEntryRecord) => void
}

type AccountingTableRow = AccountingOnlineIncomeRecord | AccountingEntryRecord

function AccountingUserCell(props: { name?: string; id?: number }) {
  return (
    <div className='flex min-w-0 flex-col'>
      <span className='truncate font-medium'>{props.name || '—'}</span>
      <span className='text-muted-foreground font-mono text-xs'>
        {props.id ? `ID: ${props.id}` : '—'}
      </span>
    </div>
  )
}

export function AccountingTable(props: AccountingTableProps) {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [props.kind, props.timeQuery.startTime, props.timeQuery.endTime])

  const listQuery = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    kind: props.kind === 'online_income' ? undefined : props.kind,
    ...props.timeQuery,
  }
  const query = useQuery({
    queryKey: ['accounting', 'list', props.kind, listQuery],
    queryFn: async () => {
      const response = props.kind === 'online_income'
        ? await getAccountingOnlineIncome(listQuery)
        : await getAccountingEntries(listQuery)
      return requireServerSuccess(response)
    },
  })

  const items: AccountingTableRow[] = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0

  const columns = useMemo<ColumnDef<AccountingTableRow>[]>(() => {
    if (props.kind === 'online_income') {
      return [
        {
          accessorKey: 'bill_no',
          header: t('Bill number'),
          meta: { mobileTitle: true },
          cell: ({ row }) => (
            <code className='block max-w-[260px] truncate font-mono text-sm'>
              {(row.original as AccountingOnlineIncomeRecord).bill_no}
            </code>
          ),
        },
        {
          accessorKey: 'type',
          header: t('Consumption type'),
          cell: ({ row }) => getAccountingConsumptionTypeLabel(
            (row.original as AccountingOnlineIncomeRecord).type,
            t
          ),
        },
        {
          accessorKey: 'payment_method',
          header: t('Payment method'),
          cell: ({ row }) => getAccountingPaymentMethodLabel(
            (row.original as AccountingOnlineIncomeRecord).payment_method,
            t
          ),
        },
        {
          accessorKey: 'amount_cents',
          header: t('Actual payment'),
          cell: ({ row }) => (
            <span className='font-medium tabular-nums'>
              {formatYuanCents((row.original as AccountingOnlineIncomeRecord).amount_cents)}
            </span>
          ),
        },
        {
          id: 'user',
          header: t('User'),
          cell: ({ row }) => {
            const user = (row.original as AccountingOnlineIncomeRecord).user
            return <AccountingUserCell name={user.name} id={user.id} />
          },
        },
        {
          accessorKey: 'create_time',
          header: t('Created at'),
          cell: ({ row }) => formatTimestampToDate(
            (row.original as AccountingOnlineIncomeRecord).create_time
          ),
        },
      ]
    }

    const amountColumn: ColumnDef<AccountingTableRow> = {
      accessorKey: 'amount_cents',
      header: props.kind === 'expense' ? t('Actual expense') : t('Actual income'),
      cell: ({ row }) => (
        <span className='font-medium tabular-nums'>
          {formatYuanCents((row.original as AccountingEntryRecord).amount_cents)}
        </span>
      ),
    }
    const commonColumns: ColumnDef<AccountingTableRow>[] = [
      {
        accessorKey: 'payment_method',
        header: t('Payment method'),
        cell: ({ row }) => getAccountingPaymentMethodLabel(
          (row.original as AccountingEntryRecord).payment_method,
          t
        ),
      },
      amountColumn,
    ]
    if (props.kind === 'offline_income') {
      commonColumns.push({
        id: 'user',
        header: t('User'),
        cell: ({ row }) => {
          const user = (row.original as AccountingEntryRecord).user
          return <AccountingUserCell name={user?.name} id={user?.id} />
        },
      })
    } else {
      commonColumns.unshift({
        accessorKey: 'target',
        header: t('Expense target'),
        meta: { mobileTitle: true },
      })
    }
    commonColumns.push(
      {
        accessorKey: 'create_time',
        header: t('Created at'),
        cell: ({ row }) => formatTimestampToDate(
          (row.original as AccountingEntryRecord).create_time
        ),
      },
      {
        id: 'actions',
        header: t('Actions'),
        enableHiding: false,
        cell: ({ row }) => (
          <AccountingRowActions
            row={row.original as AccountingEntryRecord}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />
        ),
      }
    )
    return commonColumns
  }, [props.kind, props.onDelete, props.onEdit, t])

  const { table } = useDataTable({
    data: items,
    columns,
    totalCount: total,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    getRowId: (row) =>
      props.kind === 'online_income'
        ? `online_income-${(row as AccountingOnlineIncomeRecord).type}-${row.id}`
        : `${props.kind}-${row.id}`,
  })

  if (query.isError) {
    return (
      <ErrorState
        description={query.error instanceof Error ? query.error.message : t('Failed to load accounting entries')}
        onRetry={() => void query.refetch()}
      />
    )
  }

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      emptyTitle={t('No accounting entries found')}
      emptyDescription={t('Accounting entries for the selected range will appear here.')}
      toolbarProps={null}
      paginationInFooter
    />
  )
}
