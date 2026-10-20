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
import '@tanstack/react-table'
import type { ReactNode } from 'react'

declare module '@tanstack/react-table' {
  interface ColumnMeta<_TData, _TValue> {
    label?: string
    /** 列标题右侧的辅助内容，独立于排序触发器。 */
    headerSuffix?: ReactNode
    description?: string
    className?: string
    pinned?: 'left' | 'right'
    // Mobile card list layout hints (used by MobileCardList)
    mobileTitle?: boolean // card title area (left, larger text)
    mobileBadge?: boolean // status badge alongside title (right)
    mobileHidden?: boolean // hide this column on mobile entirely
    mobileOrder?: number // lower values appear first in card field area
  }
}
