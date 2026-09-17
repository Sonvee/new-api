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
import type { IAreaChartSpec, IBarChartSpec } from '@visactor/vchart'
import type { TFunction } from 'i18next'

import type { AccountingChartType, AccountingTrendPoint } from '../types'
import { formatYuanCents } from './format'

interface AccountingChartRow {
  Time: string
  Metric: string
  Amount: number
}

/** 金额始终保留整数分；只在轴和 Tooltip 展示边界格式化为元。 */
export function createAccountingTrendSpec(
  points: AccountingTrendPoint[],
  chartType: AccountingChartType,
  t: TFunction,
  colors: string[],
  visiblePoints: number
): IBarChartSpec | IAreaChartSpec {
  const metrics = [t('Total income'), t('Total expense'), t('Gross profit')]
  const values: AccountingChartRow[] = points.flatMap((point) => [
    { Time: point.time, Metric: metrics[0], Amount: point.total_income_cents },
    { Time: point.time, Metric: metrics[1], Amount: point.total_expense_cents },
    { Time: point.time, Metric: metrics[2], Amount: point.gross_profit_cents },
  ])
  const scrollEnd = Math.min(1, visiblePoints / Math.max(points.length, 1))
  const common = {
    data: [{ id: 'accountingTrend', values }],
    yField: 'Amount',
    seriesField: 'Metric',
    stack: false,
    color: { type: 'ordinal', domain: metrics, range: colors },
    axes: [
      { id: 'accountingTime', orient: 'bottom', type: 'band' },
      {
        orient: 'left',
        type: 'linear',
        zero: true,
        label: { formatMethod: (value) => formatYuanCents(Number(value)) },
      },
    ],
    legends: {
      visible: true,
      orient: 'bottom',
      selectMode: 'multiple',
      defaultSelected: metrics,
    },
    tooltip: {
      mark: {
        content: [
          {
            key: (datum) => datum?.Metric,
            value: (datum) => formatYuanCents(Number(datum?.Amount)),
          },
        ],
      },
      dimension: {
        content: [
          {
            key: (datum) => datum?.Metric,
            value: (datum) => formatYuanCents(Number(datum?.Amount)),
          },
        ],
      },
    },
    scrollBar: {
      visible: scrollEnd < 1,
      orient: 'bottom',
      axisId: 'accountingTime',
      filterMode: 'axis',
      start: 0,
      end: scrollEnd,
      roamScroll: { enable: true },
      roamDrag: { enable: true },
      height: 12,
    },
    title: { visible: points.length === 0, text: t('No data available') },
    background: 'transparent',
    animation: false,
  } satisfies Omit<IAreaChartSpec, 'type'>
  if (chartType === 'bar') {
    return {
      ...common,
      type: 'bar',
      // 二级 band 字段是分组柱状图的关键；只有 stack:false 会造成柱子重叠。
      xField: ['Time', 'Metric'],
      barGapInGroup: 2,
      barMaxWidth: 24,
    }
  }
  return {
    ...common,
    type: 'area',
    xField: 'Time',
    area: { style: { fillOpacity: 0.08, curveType: 'monotone' } },
    line: { style: { lineWidth: 2, curveType: 'monotone' } },
    point: { visible: false },
  }
}
