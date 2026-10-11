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
import { describe, expect, test } from 'vitest'

import { sortAnnouncementsForDisplay } from '../use-notifications'

describe('notification announcement sorting', () => {
  test('places older pinned notices before newer nonpinned notices', () => {
    const sorted = sortAnnouncementsForDisplay([
      { content: 'new nonpinned', publishDate: '2026-09-09T02:00:00.000Z' },
      {
        content: 'older pinned',
        publishDate: '2026-09-01T02:00:00.000Z',
        pinned: true,
      },
      {
        content: 'newer pinned',
        publishDate: '2026-09-08T02:00:00.000Z',
        pinned: true,
      },
    ])

    expect(sorted.map((item) => item.content)).toEqual([
      'newer pinned',
      'older pinned',
      'new nonpinned',
    ])
  })
})
