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
import { VChart } from '@visactor/react-vchart'
import { AreaChart, BarChart3, ChartNoAxesCombined } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { useThemeCustomization } from '@/context/theme-customization-provider'
import { useTheme } from '@/context/theme-provider'
import { getDashboardChartColors } from '@/features/dashboard/lib/charts'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'

import { ACCOUNTING_CHART_OPTIONS } from '../constants'
import { createAccountingTrendSpec } from '../lib/charts'
import type { AccountingChartType, AccountingTrendPoint } from '../types'

interface AccountingTrendChartProps {
  points?: AccountingTrendPoint[]
  loading: boolean
  error: boolean
  onRetry: () => void
}

const EMPTY_POINTS: AccountingTrendPoint[] = []
const PALETTE = getDashboardChartColors(4)
const COLORS = [PALETTE[3], PALETTE[2], PALETTE[0]]
const CHART_ICONS = { bar: BarChart3, area: AreaChart }
let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

/** 图表只转换服务端趋势数据；筛选和请求由页面统一管理。 */
export function AccountingTrendChart(props: AccountingTrendChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { customization } = useThemeCustomization()
  const [chartType, setChartType] = useState<AccountingChartType>('bar')
  const [readyTheme, setReadyTheme] = useState<string>()
  const [themeError, setThemeError] = useState(false)
  const [themeRevision, setThemeRevision] = useState(0)
  const [visiblePoints, setVisiblePoints] = useState(7)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setVisiblePoints(Math.max(2, Math.floor((width - 130) / 90)))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    setThemeError(false)
    if (!themeManagerPromise) {
      themeManagerPromise = import('@visactor/vchart').then(
        (module) => module.ThemeManager
      )
    }
    themeManagerPromise
      .then((manager) => {
        if (!active) return
        manager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
        setReadyTheme(resolvedTheme)
      })
      .catch((error: unknown) => {
        themeManagerPromise = null
        if (!active) return
        setThemeError(true)
        handleServerError(error)
      })
    return () => {
      active = false
    }
  }, [resolvedTheme, themeRevision])

  const spec = useMemo(
    () =>
      createAccountingTrendSpec(
        props.points ?? EMPTY_POINTS,
        chartType,
        t,
        COLORS,
        visiblePoints
      ),
    [props.points, chartType, t, visiblePoints]
  )

  let content = (
    <VChart
      key={`${chartType}-${resolvedTheme}-${customization.preset}`}
      spec={{ ...spec, theme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
      option={VCHART_OPTION}
    />
  )
  if (props.loading || readyTheme !== resolvedTheme) {
    content = <LoadingState className='h-full min-h-0' />
  }
  if (props.error || themeError) {
    content = (
      <ErrorState
        className='h-full min-h-0'
        onRetry={() => {
          if (themeError) setThemeRevision((current) => current + 1)
          if (props.error) props.onRetry()
        }}
      />
    )
  }

  return (
    <div className='h-full min-h-0'>
      <section
        className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border'
        aria-label={t('Analytics')}
      >
        <div className='flex flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-2'>
            <IconBadge tone='success' size='sm'>
              <ChartNoAxesCombined aria-hidden='true' />
            </IconBadge>
            <h2 className='text-sm font-semibold'>{t('Analytics')}</h2>
          </div>
          <div className='bg-muted/60 inline-flex w-full overflow-x-auto rounded-lg border p-0.5 sm:w-auto'>
            {ACCOUNTING_CHART_OPTIONS.map((option) => {
              const Icon = CHART_ICONS[option.value]
              return (
                <Button
                  key={option.value}
                  type='button'
                  variant='ghost'
                  size='sm'
                  aria-pressed={chartType === option.value}
                  onClick={() => setChartType(option.value)}
                  className={cn(
                    'gap-1.5 rounded-md px-3 text-xs sm:h-7',
                    chartType === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className='size-3.5' aria-hidden='true' />
                  {t(option.labelKey)}
                </Button>
              )
            })}
          </div>
        </div>
        <div
          ref={containerRef}
          className='min-h-0 min-w-0 flex-1 p-1.5 sm:p-2'
        >
          {content}
        </div>
      </section>
    </div>
  )
}
