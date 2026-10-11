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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { NotificationPopover } from '../notification-popover'

describe('notification announcement pin marker', () => {
  test('keeps the pin marker on the metadata row for pinned announcements', () => {
    render(
      <NotificationPopover
        open
        onOpenChange={() => undefined}
        unreadCount={0}
        activeTab='announcements'
        onTabChange={() => undefined}
        notice=''
        announcements={[
          {
            content: 'Pinned maintenance notice',
            publishDate: '2026-09-08T01:44:56Z',
            pinned: true,
          },
          {
            content: 'Regular update',
            publishDate: '2026-09-08T00:44:56Z',
          },
        ]}
        loading={false}
      />
    )

    const marker = screen.getByLabelText('Pinned')
    expect(marker).toBeInTheDocument()
    expect(marker.parentElement).toHaveClass('flex', 'items-center')
    expect(screen.getByText('Pinned maintenance notice')).toBeInTheDocument()
  })
})
