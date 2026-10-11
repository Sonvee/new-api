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
import { cn } from '@/lib/utils'

import { Badge } from './ui/badge'

export interface IdentityBadgeProps {
  /** User group text. Matching ignores case; supported badge text is displayed in uppercase. */
  identity?: string | null
  className?: string
}

type IdentityStyle = 'vip' | 'svip' | 'premium'

function getIdentityStyle(identity: string): IdentityStyle | null {
  const normalizedIdentity = identity.trim().toLowerCase()

  if (normalizedIdentity === 'vip') return 'vip'
  if (normalizedIdentity === 'svip') return 'svip'
  if (normalizedIdentity === 'premium') return 'premium'

  return null
}

/**
 * Displays a user's group as a highlighted identity badge when supported.
 * Unsupported groups keep the profile page's plain-text presentation.
 */
export function IdentityBadge(props: IdentityBadgeProps) {
  if (!props.identity?.trim()) return null

  const style = getIdentityStyle(props.identity)
  if (!style) {
    return <span className={cn('truncate', props.className)}>{props.identity}</span>
  }

  return (
    <Badge
      variant='outline'
      className={cn(
        'max-w-full min-w-0 shrink-0 px-2 py-0.5 text-xs leading-none',
        style === 'vip' &&
          'border-sky-300/80 bg-sky-100/60 text-sky-700 dark:border-sky-300/70 dark:bg-sky-950/50 dark:text-sky-200',
        style === 'svip' &&
          'border-rose-400/80 bg-rose-100/60 text-rose-700 shadow-[0_0_10px_rgba(244,63,94,0.35)] dark:border-rose-300/80 dark:bg-rose-950/45 dark:text-rose-200',
        style === 'premium' && 'identity-badge-premium',
        props.className
      )}
    >
      {style === 'premium' ? (
        <span className='identity-badge-premium__label'>
          {props.identity.trim().toUpperCase()}
        </span>
      ) : (
        props.identity.trim().toUpperCase()
      )}
    </Badge>
  )
}
