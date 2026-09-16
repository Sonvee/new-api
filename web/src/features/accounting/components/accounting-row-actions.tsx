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
import { Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { AccountingEntryRecord } from '../types'

type AccountingRowActionsProps = {
  row: AccountingEntryRecord
  onEdit: (row: AccountingEntryRecord) => void
  onDelete: (row: AccountingEntryRecord) => void
}

export function AccountingRowActions(props: AccountingRowActionsProps) {
  const { t } = useTranslation()

  return (
    <div className='flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={t('Edit accounting entry')}
              onClick={() => props.onEdit(props.row)}
            />
          }
        >
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={t('Delete accounting entry')}
              onClick={() => props.onDelete(props.row)}
            />
          }
        >
          <Trash2 />
        </TooltipTrigger>
        <TooltipContent>{t('Delete')}</TooltipContent>
      </Tooltip>
    </div>
  )
}
