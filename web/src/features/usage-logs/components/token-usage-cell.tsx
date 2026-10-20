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

import { TruncatedCell } from '@/components/data-table'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import type { LogOtherData } from '../types'

interface TokenUsageCellProps {
  promptTokens: number
  completionTokens: number
  other: LogOtherData | null
}

/** 展示日志原始用量；悬停明细将普通输入和缓存分开，避免总量重复计算。 */
export function TokenUsageCell(props: TokenUsageCellProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const promptTokens = props.promptTokens || 0
  const completionTokens = props.completionTokens || 0
  const cacheReadTokens = props.other?.cache_tokens || 0
  const cacheWriteTokens =
    props.other?.cache_write_tokens ??
    Math.max(
      props.other?.cache_creation_tokens || 0,
      (props.other?.cache_creation_tokens_5m || 0) +
        (props.other?.cache_creation_tokens_1h || 0)
    )

  if (
    promptTokens === 0 &&
    completionTokens === 0 &&
    cacheReadTokens === 0 &&
    cacheWriteTokens === 0
  ) {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  // Claude 的普通输入不含缓存；OpenAI 的输入通常已包含缓存。
  // 优先使用服务端归一化的输入总量，不按模型名或价格推断用量。
  const cachedTokens = cacheReadTokens + cacheWriteTokens
  const totalInputTokens =
    props.other?.input_tokens_total ??
    (props.other?.claude ? promptTokens + cachedTokens : promptTokens)
  const inputTokens = Math.max(0, totalInputTokens - cachedTokens)
  const totalTokens = totalInputTokens + completionTokens
  const cacheHitRate =
    totalInputTokens > 0 ? (cacheReadTokens / totalInputTokens) * 100 : 0
  const details = [
    { label: t('Input'), value: inputTokens },
    { label: t('Output'), value: completionTokens },
    { label: t('Cache Read'), value: cacheReadTokens },
    { label: t('Cache Write'), value: cacheWriteTokens },
  ]

  return (
    <TruncatedCell
      tabIndex={0}
      className='focus-visible:ring-ring w-fit cursor-help rounded-sm outline-none focus-visible:ring-2'
      tooltipClassName='py-2'
      tooltipContent={
        <div className='min-w-44 space-y-1.5'>
          <p className='font-medium'>{t('Token Breakdown')}</p>
          <dl className='space-y-1'>
            {details.map((detail) => (
              <div key={detail.label} className='flex justify-between gap-6'>
                <dt>{detail.label}:</dt>
                <dd className='font-mono tabular-nums'>
                  {formatNumber(detail.value, locale)}
                </dd>
              </div>
            ))}
            <div className='border-background/20 flex justify-between gap-6 border-t pt-1 font-medium'>
              <dt>{t('Total Tokens')}:</dt>
              <dd className='font-mono tabular-nums'>
                {formatNumber(totalTokens, locale)}
              </dd>
            </div>
            <div className='flex justify-between gap-6'>
              <dt>{t('Cache hit rate')}:</dt>
              <dd className='font-mono tabular-nums'>
                {formatNumber(cacheHitRate, locale)}%
              </dd>
            </div>
          </dl>
        </div>
      }
    >
      <div className='flex flex-col gap-0.5'>
        <span className='font-mono text-xs font-medium tabular-nums'>
          {formatNumber(promptTokens, locale)} /{' '}
          {formatNumber(completionTokens, locale)}
        </span>
        {(cacheReadTokens > 0 || cacheWriteTokens > 0) && (
          <div className='flex items-center gap-1 text-[11px]'>
            {cacheReadTokens > 0 && (
              <span className='text-muted-foreground/60'>
                {t('Cache')}↓ {formatNumber(cacheReadTokens, locale)}
              </span>
            )}
            {cacheWriteTokens > 0 && (
              <span className='text-muted-foreground/60'>
                ↑ {formatNumber(cacheWriteTokens, locale)}
              </span>
            )}
          </div>
        )}
      </div>
    </TruncatedCell>
  )
}
