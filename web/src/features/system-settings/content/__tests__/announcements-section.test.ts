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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { getNextAnnouncementId } from '../lib/announcement-id'

describe('announcement ID generation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('does not reuse an ID after the previous highest announcement was deleted', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)

    expect(getNextAnnouncementId([{ id: 1 }])).toBe(100)
  })

  test('keeps generated IDs greater than existing timestamp-based IDs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)

    expect(getNextAnnouncementId([{ id: 200 }])).toBe(201)
  })
})
