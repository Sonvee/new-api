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
import { formatQuotaWithCurrency } from '@/lib/currency'

/** 小额红包保留内部最小单位的展示精度，不使用 k 缩写。 */
export function formatWelfareQuota(quota: number, locale: string): string {
  return formatQuotaWithCurrency(quota, {
    digitsLarge: 6,
    digitsSmall: 8,
    abbreviate: false,
    locale,
  })
}

/** 展示时区固定中国大陆，与浏览器自身时区无关。 */
export function formatWelfareTime(timestamp: number, locale: string): string {
  if (!timestamp) return '-'
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(timestamp * 1000))
}

/** datetime-local 输入的是北京时间墙上时间，不是浏览器本地时间。 */
export function welfareTimeInput(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp * 1000))
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
}
