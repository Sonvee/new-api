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
import type { ColumnDef, ColumnFiltersState, OnChangeFn } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { StatusBadge, type StatusBadgeProps } from '@/components/status-badge'
import { formatLocalCurrencyAmount } from '@/lib/currency'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getBillingConsumptions, getWalletLedgers } from '../api'
import type { BillingConsumptionRecord, BillingRecordQuery, WalletLedgerRecord } from '../types'

type BillingRecordsTableProps = {
  kind: 'consumption' | 'ledger'
}

type TableRow = BillingConsumptionRecord | WalletLedgerRecord

const CONSUMPTION_TYPES = [
  { value: 'topup', label: 'Balance top-up' },
  { value: 'subscription', label: 'Subscription purchase' },
]

const LEDGER_TYPES = [
  { value: 'topup', label: 'Balance top-up' },
  { value: 'redemption', label: 'Redemption code' },
  { value: 'admin_topup', label: 'Admin top-up' },
  { value: 'subscription', label: 'Subscription purchase' },
  { value: 'admin_adjustment', label: 'Admin adjustment' },
  { value: 'invitation_reward', label: 'Invitation reward' },
  { value: 'commission', label: 'Commission rebate' },
  { value: 'checkin', label: 'Check-in reward' },
  { value: 'system_grant', label: 'System grant' },
]

function getFilterValue(filters: ColumnFiltersState, id: string) {
  const value = filters.find((filter) => filter.id === id)?.value
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}

function getStatusVariant(status: string): StatusBadgeProps['variant'] {
  if (status === 'success') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'expired' || status === 'failed' || status === 'cancelled') return 'danger'
  return 'neutral'
}

function getTypeLabel(type: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    topup: 'Balance top-up',
    redemption: 'Redemption code',
    admin_topup: 'Admin top-up',
    subscription: 'Subscription purchase',
    admin_adjustment: 'Admin adjustment',
    invitation_reward: 'Invitation reward',
    commission: 'Commission rebate',
    checkin: 'Check-in reward',
    system_grant: 'System grant',
  }
  return t(labels[type] ?? type)
}

function getPaymentMethodLabel(method: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    wxpay: 'WeChat Pay',
    alipay: 'Alipay',
    stripe: 'Stripe',
    creem: 'Creem',
    waffo: 'Waffo',
    waffo_pancake: 'Waffo Pancake',
    balance: 'Wallet balance',
  }
  return t(labels[method] ?? method)
}

function getStatusLabel(status: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    success: 'Success',
    pending: 'Pending',
    expired: 'Expired',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return t(labels[status] ?? 'Unknown')
}

export function BillingRecordsTable(props: BillingRecordsTableProps) {
  const { t } = useTranslation()
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const onColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>((updater) => {
    setColumnFilters(updater)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [])

  const onGlobalFilterChange = useCallback<OnChangeFn<string>>((updater) => {
    setGlobalFilter(updater)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }, [])

  const typeFilter = getFilterValue(columnFilters, 'type')
  const paymentMethodFilter = getFilterValue(columnFilters, 'payment_method')
  const statusFilter = getFilterValue(columnFilters, 'status')
  const directionFilter = getFilterValue(columnFilters, 'direction')

  const queryParams: BillingRecordQuery = {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    keyword: globalFilter,
    type: typeFilter,
    paymentMethod: props.kind === 'consumption' ? paymentMethodFilter : undefined,
    status: props.kind === 'consumption' ? statusFilter : undefined,
    direction: props.kind === 'ledger' ? directionFilter : undefined,
  }

  const query = useQuery({
    queryKey: ['billing-records', props.kind, queryParams],
    queryFn: async () => {
      const response = props.kind === 'consumption'
        ? await getBillingConsumptions(queryParams)
        : await getWalletLedgers(queryParams)
      return requireServerSuccess(response)
    },
  })

  const items = query.data?.data?.items ?? []
  const total = query.data?.data?.total ?? 0

  const columns = useMemo<ColumnDef<TableRow>[]>(() => {
    if (props.kind === 'consumption') {
      return [
        {
          accessorKey: 'bill_no',
          header: t('Bill number'),
          meta: { mobileTitle: true },
          cell: ({ row }) => {
            const record = row.original as BillingConsumptionRecord
            return (
              <div className='flex min-w-0 items-center gap-1'>
                <code className='truncate font-mono text-sm'>{record.bill_no}</code>
                <CopyButton
                  value={record.bill_no}
                  size='icon'
                  className='size-7'
                  iconClassName='size-3.5'
                  tooltip={t('Copy bill number')}
                />
              </div>
            )
          },
        },
        { accessorKey: 'type', header: t('Consumption type'), cell: ({ row }) => getTypeLabel((row.original as BillingConsumptionRecord).type, t) },
        { accessorKey: 'payment_method', header: t('Payment method'), cell: ({ row }) => getPaymentMethodLabel((row.original as BillingConsumptionRecord).payment_method, t) },
        { accessorKey: 'amount', header: t('Actual payment'), cell: ({ row }) => <span className='font-medium'>{formatLocalCurrencyAmount(Number((row.original as BillingConsumptionRecord).amount))}</span> },
        {
          accessorKey: 'status',
          header: t('Status'),
          meta: { mobileBadge: true },
          cell: ({ row }) => {
            const status = (row.original as BillingConsumptionRecord).status
            return <StatusBadge label={getStatusLabel(status, t)} variant={getStatusVariant(status)} copyable={false} />
          },
        },
        { accessorKey: 'create_time', header: t('Created at'), cell: ({ row }) => formatTimestampToDate((row.original as BillingConsumptionRecord).create_time) },
      ]
    }

    return [
      {
        accessorKey: 'ledger_no',
        header: t('Ledger number'),
        meta: { mobileTitle: true },
        cell: ({ row }) => {
          const record = row.original as WalletLedgerRecord
          return (
            <div className='flex min-w-0 items-center gap-1'>
              <code className='truncate font-mono text-sm'>{record.ledger_no}</code>
              <CopyButton
                value={record.ledger_no}
                size='icon'
                className='size-7'
                iconClassName='size-3.5'
                tooltip={t('Copy ledger number')}
              />
            </div>
          )
        },
      },
      { accessorKey: 'type', header: t('Ledger type'), cell: ({ row }) => getTypeLabel((row.original as WalletLedgerRecord).type, t) },
      {
        accessorKey: 'delta_quota',
        header: t('Balance change'),
        cell: ({ row }) => {
          const value = Number((row.original as WalletLedgerRecord).delta_quota)
          return <span className={value >= 0 ? 'font-medium text-success' : 'font-medium text-destructive'}>{value >= 0 ? '+' : '-'}{formatQuota(Math.abs(value))}</span>
        },
      },
      { accessorKey: 'balance_before', header: t('Balance before'), cell: ({ row }) => formatQuota(Number((row.original as WalletLedgerRecord).balance_before)) },
      { accessorKey: 'balance_after', header: t('Balance after'), cell: ({ row }) => formatQuota(Number((row.original as WalletLedgerRecord).balance_after)) },
      { accessorKey: 'created_at', header: t('Created at'), cell: ({ row }) => formatTimestampToDate((row.original as WalletLedgerRecord).created_at) },
      {
        id: 'direction',
        accessorFn: (row) => Number((row as WalletLedgerRecord).delta_quota) >= 0 ? 'increase' : 'decrease',
        header: t('Direction'),
        enableHiding: false,
      },
    ]
  }, [props.kind, t])

  const { table } = useDataTable({
    data: items,
    columns,
    totalCount: total,
    pagination,
    columnFilters,
    globalFilter,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onPaginationChange: setPagination,
    initialColumnVisibility: props.kind === 'ledger' ? { direction: false } : undefined,
    manualFiltering: true,
    manualPagination: true,
    getRowId: (row) => String(row.id),
  })

  const toolbarFilters = props.kind === 'consumption'
    ? [
        {
          columnId: 'type',
          title: t('Consumption type'),
          options: CONSUMPTION_TYPES.map((option) => ({ ...option, label: t(option.label) })),
          singleSelect: true,
        },
        {
          columnId: 'payment_method',
          title: t('Payment method'),
          options: [
            { value: 'wxpay', label: t('WeChat Pay') },
            { value: 'alipay', label: t('Alipay') },
            { value: 'stripe', label: 'Stripe' },
            { value: 'creem', label: 'Creem' },
            { value: 'waffo', label: 'Waffo' },
            { value: 'waffo_pancake', label: 'Waffo Pancake' },
          ],
          singleSelect: true,
        },
        {
          columnId: 'status',
          title: t('Status'),
          options: [
            { value: 'success', label: t('Success') },
            { value: 'pending', label: t('Pending') },
            { value: 'expired', label: t('Expired') },
            { value: 'failed', label: t('Failed') },
            { value: 'cancelled', label: t('Cancelled') },
          ],
          singleSelect: true,
        },
      ]
    : [
        {
          columnId: 'type',
          title: t('Ledger type'),
          options: LEDGER_TYPES.map((option) => ({ ...option, label: t(option.label) })),
          singleSelect: true,
        },
        {
          columnId: 'direction',
          title: t('Direction'),
          options: [
            { value: 'increase', label: t('Increase') },
            { value: 'decrease', label: t('Decrease') },
          ],
          singleSelect: true,
        },
      ]

  if (query.isError) {
    return <ErrorState description={query.error instanceof Error ? query.error.message : t('Failed to load billing records')} onRetry={() => void query.refetch()} />
  }

  const hasFilters = Boolean(globalFilter || columnFilters.length)

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={query.isLoading}
      isFetching={query.isFetching}
      emptyTitle={t('No billing records found')}
      emptyDescription={hasFilters ? t('Try adjusting your search') : t('Your transaction history will appear here')}
      toolbarProps={{
        searchPlaceholder: props.kind === 'consumption' ? t('Search by bill number...') : t('Search by ledger or source number...'),
        searchDebounceMs: 300,
        filters: toolbarFilters,
      }}
      paginationInFooter
    />
  )
}


