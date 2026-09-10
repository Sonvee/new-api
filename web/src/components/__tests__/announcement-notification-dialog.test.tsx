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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useNotifications } from '@/hooks/use-notifications'

import { AnnouncementNotificationDialog } from '../announcement-notification-dialog'

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: vi.fn(),
}))

const mockedUseNotifications = vi.mocked(useNotifications)

describe('announcement notification dialog', () => {
  beforeEach(() => {
    mockedUseNotifications.mockReset()
  })

  test('shows zero remaining announcements for the only active announcement and can close from the icon', async () => {
    mockedUseNotifications.mockReturnValue({
      unreadAnnouncements: [
        {
          id: 1,
          content: 'Only announcement',
          publishDate: '2026-09-10T12:00:00Z',
          type: 'success',
        },
      ],
      markUnreadAnnouncementsAsRead: vi.fn(),
    } as unknown as ReturnType<typeof useNotifications>)

    render(<AnnouncementNotificationDialog />)

    expect(
      await screen.findByText('Remaining 0 unread announcements')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.queryByText('Only announcement')).not.toBeInTheDocument()
    })
  })

  test('updates the remaining count after moving to the next announcement', async () => {
    mockedUseNotifications.mockReturnValue({
      unreadAnnouncements: [
        { id: 1, content: 'First announcement' },
        { id: 2, content: 'Second announcement' },
      ],
      markUnreadAnnouncementsAsRead: vi.fn(),
    } as unknown as ReturnType<typeof useNotifications>)

    render(<AnnouncementNotificationDialog />)

    expect(
      await screen.findByText('Remaining 1 unread announcements')
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next announcement' }))

    expect(screen.getByText('Second announcement')).toBeInTheDocument()
    expect(screen.getByText('Remaining 0 unread announcements')).toBeInTheDocument()
  })
})
