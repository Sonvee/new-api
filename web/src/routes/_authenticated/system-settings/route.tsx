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
import { createFileRoute, redirect } from '@tanstack/react-router'

import { SystemSettings } from '@/features/system-settings'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/system-settings')({
  beforeLoad: ({ location }) => {
    const { auth } = useAuthStore.getState()

    // 只开放福利管理这一条路径，不扩大普通管理员对其他系统设置的权限。
    const isWelfareManagement =
      location.pathname.replace(/\/$/, '') ===
      '/system-settings/site/welfare-activities'
    if (isWelfareManagement && auth.user?.role === ROLE.ADMIN) return

    if (auth.user?.role !== ROLE.SUPER_ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  component: SystemSettings,
})
