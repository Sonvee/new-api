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
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import { getWelfareIssues, welfareKeys } from '../api'
import { ClaimsTable } from './claims-table'
import { IssueStatus } from './issue-status'

export function ClaimHistory(props: { currentIssueNo?: number | null }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const lastCurrentIssue = useRef(props.currentIssueNo)
  const [selectedIssueNo, setSelectedIssueNo] = useState<number | null>(null)
  const query = useInfiniteQuery({
    queryKey: welfareKeys.issues,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getWelfareIssues(pageParam),
    refetchOnMount: 'always',
    getNextPageParam: (last) =>
      last.page * last.page_size < last.total ? last.page + 1 : undefined,
    retry: false,
  })
  useEffect(() => {
    if (lastCurrentIssue.current !== props.currentIssueNo) {
      lastCurrentIssue.current = props.currentIssueNo
      void queryClient.invalidateQueries({ queryKey: welfareKeys.issues })
    }
  }, [props.currentIssueNo, queryClient])
  const issues = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.items) ?? []).map((issue) => [
        issue.id,
        issue,
      ])
    ).values(),
  ]
  const issueNo = selectedIssueNo ?? props.currentIssueNo ?? issues[0]?.issue_no
  const selectedIssue = issues.find((issue) => issue.issue_no === issueNo)
  return (
    <Card className='flex h-full min-h-0 flex-col' data-card-hover='false'>
      <CardHeader className='shrink-0'>
        <CardTitle>{t('Red packet claim history')}</CardTitle>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col gap-4'>
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? (
          <ErrorState
            onRetry={() => {
              void query.refetch()
            }}
          />
        ) : null}
        {!query.isLoading &&
        !query.isError &&
        issues.length === 0 &&
        !issueNo ? (
          <EmptyState title={t('No red packet issues yet')} />
        ) : null}
        {!query.isError && (issues.length > 0 || !!issueNo) ? (
          <>
            <div className='flex shrink-0 flex-wrap items-center gap-3'>
              <NativeSelect
                aria-label={t('Select red packet issue')}
                value={issueNo ?? ''}
                onChange={(event) =>
                  setSelectedIssueNo(Number(event.target.value))
                }
              >
                {issueNo &&
                !issues.some((issue) => issue.issue_no === issueNo) ? (
                  <NativeSelectOption value={issueNo}>
                    {t('Issue {{number}}', { number: issueNo })}
                  </NativeSelectOption>
                ) : null}
                {issues.map((issue) => (
                  <NativeSelectOption
                    key={issue.id}
                    value={issue.issue_no ?? ''}
                  >
                    {t('Issue {{number}}', { number: issue.issue_no })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {selectedIssue ? (
                <IssueStatus status={selectedIssue.status} />
              ) : null}
              {query.hasNextPage ? (
                <Button
                  variant='outline'
                  disabled={query.isFetchingNextPage}
                  onClick={() => {
                    void query.fetchNextPage()
                  }}
                >
                  {t('Load older issues')}
                </Button>
              ) : null}
            </div>
            {issueNo ? (
              <div className='min-h-0 flex-1'>
                <ClaimsTable key={issueNo} issueNo={issueNo} fixedHeight />
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
