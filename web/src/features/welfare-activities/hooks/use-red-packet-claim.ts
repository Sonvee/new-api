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
import { useRef } from 'react'

import { getSelf } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { claimWelfareIssue, welfareKeys } from '../api'

/** 前端即时防连点只改善交互；每期唯一领取及余额原子性由服务端负责。 */
export function useRedPacketClaim() {
  const queryClient = useQueryClient()
  const inFlight = useRef(false)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const mutation = useMutation({
    mutationFn: claimWelfareIssue,
    retry: false,
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: welfareKeys.all })
      void queryClient.invalidateQueries({
        queryKey: ['billing-records', 'ledger'],
      })
      // 发放已成功；余额刷新失败只报刷新错误，不能把领取改为失败或再次发钱。
      try {
        const result = requireServerSuccess(await getSelf())
        const auth = useAuthStore.getState().auth
        if (
          auth.user &&
          auth.user.id === userId &&
          result.data?.id === userId
        ) {
          auth.setUser({ ...auth.user, quota: result.data.quota })
        }
      } catch (error) {
        handleServerError(error)
      }
    },
    onError: (error) => {
      handleServerError(error)
      void queryClient.invalidateQueries({ queryKey: welfareKeys.all })
    },
    onSettled: () => {
      inFlight.current = false
    },
  })
  const claimIssue = (issueNo: number): void => {
    if (inFlight.current || mutation.isPending) return
    inFlight.current = true
    mutation.mutate(issueNo)
  }
  return { mutation, claimIssue }
}
