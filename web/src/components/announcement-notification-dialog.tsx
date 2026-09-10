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
import { Megaphone01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/hooks/use-notifications'
import {
  getAnnouncementTextColorClass,
  type AnnouncementType,
} from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

interface UnreadAnnouncement {
  id?: number | string
  content?: string
  publishDate?: string | Date
  type?: string
}

/**
 * Displays unread system announcements in a blocking, global dialog.
 * Announcements are marked read only after the user acknowledges the queue.
 */
export function AnnouncementNotificationDialog() {
  const { t } = useTranslation()
  const {
    unreadAnnouncements: rawUnreadAnnouncements,
    markUnreadAnnouncementsAsRead,
  } = useNotifications()
  const unreadAnnouncements = rawUnreadAnnouncements as UnreadAnnouncement[]
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const previousUnreadSignature = useRef('')

  const unreadSignature = useMemo(
    () =>
      unreadAnnouncements
        .map((item, index) =>
          item.id !== undefined && item.id !== null
            ? `id:${item.id}`
            : `${index}:${item.publishDate ?? ''}:${item.content ?? ''}`
        )
        .join('|'),
    [unreadAnnouncements]
  )

  useEffect(() => {
    if (unreadAnnouncements.length === 0) {
      previousUnreadSignature.current = ''
      setOpen(false)
      setActiveIndex(0)
      return
    }

    if (unreadSignature !== previousUnreadSignature.current) {
      setOpen(true)
      setActiveIndex(0)
      previousUnreadSignature.current = unreadSignature
    }
  }, [unreadAnnouncements.length, unreadSignature])

  const activeAnnouncement = unreadAnnouncements[activeIndex]
  if (!activeAnnouncement) return null

  const remainingCount = unreadAnnouncements.length - activeIndex - 1
  const announcementType = activeAnnouncement.type as AnnouncementType | undefined
  const date = activeAnnouncement.publishDate
    ? new Date(activeAnnouncement.publishDate)
    : null
  const dateLabel =
    date && !Number.isNaN(date.getTime()) ? formatDateTimeObject(date) : ''

  const handleNext = () => {
    setActiveIndex((index) => Math.min(index + 1, unreadAnnouncements.length - 1))
  }

  const handleAcknowledge = () => {
    markUnreadAnnouncementsAsRead()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      disablePointerDismissal
      title={
        <span
          className={cn(
            'flex items-center gap-2',
            getAnnouncementTextColorClass(announcementType)
          )}
        >
          <HugeiconsIcon icon={Megaphone01Icon} aria-hidden='true' />
          {t('Notification Announcements')}
        </span>
      }
      contentClassName='sm:max-w-xl'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <div className='flex w-full items-center justify-end gap-2'>
          <Button
            variant='outline'
            onClick={handleNext}
            disabled={activeIndex >= unreadAnnouncements.length - 1}
          >
            {t('Next announcement')}
          </Button>
          <Button onClick={handleAcknowledge}>{t('I acknowledge')}</Button>
        </div>
      }
      showCloseButton
    >
      <div className='space-y-5'>
        <div className='min-h-24 text-sm leading-6'>
          <RichContent breaks content={activeAnnouncement.content || ''} />
        </div>
        <div className='text-muted-foreground flex items-center justify-between gap-4 pt-1 text-xs'>
          <span>
            {t('Remaining {{count}} unread announcements', {
              count: remainingCount,
            })}
          </span>
          {dateLabel ? (
            <time dateTime={date?.toISOString()}>{dateLabel}</time>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
