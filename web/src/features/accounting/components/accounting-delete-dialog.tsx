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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { deleteAccountingEntry } from '../api'
import { ACCOUNTING_SUCCESS_MESSAGES } from '../constants'
import type { AccountingEntryRecord } from '../types'

type AccountingDeleteDialogProps = {
  currentRow?: AccountingEntryRecord
  onOpenChange: (open: boolean) => void
}

export function AccountingDeleteDialog(props: AccountingDeleteDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (!props.currentRow) return
      return requireServerSuccess(await deleteAccountingEntry(props.currentRow.id))
    },
    onSuccess: async () => {
      toast.success(t(ACCOUNTING_SUCCESS_MESSAGES.DELETED))
      props.onOpenChange(false)
      await queryClient.invalidateQueries({ queryKey: ['accounting'] })
    },
    onError: (error) => handleServerError(error, t('Failed to delete accounting entry')),
  })

  return (
    <ConfirmDialog
      open={Boolean(props.currentRow)}
      onOpenChange={props.onOpenChange}
      title={t('Delete accounting entry')}
      desc={t('This action permanently deletes the accounting entry and cannot be undone.')}
      destructive
      confirmText={t('Delete')}
      isLoading={mutation.isPending}
      handleConfirm={() => mutation.mutate()}
    />
  )
}
