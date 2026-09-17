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
import { Plus } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUserQuotaStats } from '@/features/users/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getAccountingStats, getAccountingTrend } from './api'
import { AccountingDeleteDialog } from './components/accounting-delete-dialog'
import { AccountingEntryDialog } from './components/accounting-entry-dialog'
import { AccountingFilterDialog } from './components/accounting-filter-dialog'
import { AccountingStatsCards } from './components/accounting-stats'
import { AccountingTable } from './components/accounting-table'
import { DEFAULT_ACCOUNTING_FILTERS } from './constants'
import { getAccountingTimeQuery } from './lib/format'
import type {
  AccountingEntryKind,
  AccountingEntryRecord,
  AccountingFilters,
  AccountingTab,
} from './types'

const AccountingTrendChart = lazy(() =>
  import('./components/accounting-trend-chart').then((module) => ({
    default: module.AccountingTrendChart,
  }))
)

export function Accounting() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AccountingTab>('online_income')
  const [filters, setFilters] = useState<AccountingFilters>(DEFAULT_ACCOUNTING_FILTERS)
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<AccountingEntryRecord>()
  const [deletingRow, setDeletingRow] = useState<AccountingEntryRecord>()

  const timeQuery = useMemo(() => getAccountingTimeQuery(filters), [filters])
  const statsQuery = useQuery({
    queryKey: ['accounting', 'stats', timeQuery],
    queryFn: async () => requireServerSuccess(await getAccountingStats(timeQuery)),
  })
  const trendQuery = useQuery({
    queryKey: ['accounting', 'trend', timeQuery, filters.granularity],
    queryFn: async () =>
      requireServerSuccess(await getAccountingTrend({
        ...timeQuery,
        granularity: filters.granularity,
      })),
    enabled: activeTab === 'analytics',
  })
  const quotaQuery = useQuery({
    queryKey: ['user-quota-stats'],
    queryFn: getUserQuotaStats,
    staleTime: 30_000,
  })

  const entryKind: AccountingEntryKind | undefined =
    activeTab === 'offline_income' || activeTab === 'expense'
      ? activeTab
      : undefined

  const handleEdit = useCallback((row: AccountingEntryRecord) => {
    setEditingRow(row)
    setEntryDialogOpen(true)
  }, [])

  const handleEntryDialogChange = useCallback((open: boolean) => {
    setEntryDialogOpen(open)
    if (!open) setEditingRow(undefined)
  }, [])

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Accounting')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 min-w-0 flex-col gap-4'>
          <AccountingStatsCards
            stats={statsQuery.data?.data}
            remainingQuota={quotaQuery.data?.remaining_quota}
            range={filters.range}
            isLoading={statsQuery.isLoading || quotaQuery.isLoading}
          />

          <div className='flex flex-wrap items-center justify-between gap-1.5 sm:gap-2'>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as AccountingTab)}
            >
              <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                <TabsTrigger value='online_income'>
                  {t('Online income')}
                </TabsTrigger>
                <TabsTrigger value='offline_income'>
                  {t('Offline income')}
                </TabsTrigger>
                <TabsTrigger value='expense'>{t('Expense')}</TabsTrigger>
                <TabsTrigger value='analytics'>{t('Analytics')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className='flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2'>
              {entryKind ? (
                <AccountingEntryDialog
                  key={`${entryKind}-${editingRow?.id ?? 'new'}`}
                  open={entryDialogOpen}
                  onOpenChange={handleEntryDialogChange}
                  kind={entryKind}
                  currentRow={editingRow}
                  trigger={
                    editingRow ? undefined : (
                      <Button type='button'>
                        <Plus data-icon='inline-start' />
                        {t('Add entry')}
                      </Button>
                    )
                  }
                />
              ) : null}
              <AccountingFilterDialog filters={filters} onApply={setFilters} />
            </div>
          </div>

          <div className='min-h-0 min-w-0 flex-1'>
            {activeTab === 'analytics' ? (
              <Suspense fallback={<LoadingState className='h-full' />}>
                <AccountingTrendChart
                  points={trendQuery.data?.data?.items}
                  loading={trendQuery.isLoading}
                  error={trendQuery.isError}
                  onRetry={() => {
                    void trendQuery.refetch()
                  }}
                />
              </Suspense>
            ) : (
              <AccountingTable
                key={activeTab}
                kind={activeTab}
                timeQuery={timeQuery}
                onEdit={handleEdit}
                onDelete={setDeletingRow}
              />
            )}
          </div>

          <AccountingDeleteDialog
            currentRow={deletingRow}
            onOpenChange={(open) => {
              if (!open) setDeletingRow(undefined)
            }}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
