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
import { useEffect, useState } from 'react'

import type { WelfareCurrent } from '../types'

/** 服务端秒数加单调时钟，浏览器改系统时间不影响倒计时。 */
export function useWelfareCountdown(current: WelfareCurrent) {
  const [, setTick] = useState(0)

  const deadline =
    current.upcoming ??
    (current.issue?.status === 'scheduled' ? current.issue : null)
  const serverNow =
    current.server_time + (performance.now() - current.receivedAt) / 1000
  const remainingSeconds = deadline
    ? Math.max(0, Math.ceil(deadline.start_at - serverNow))
    : 0
  const deadlineKey = deadline
    ? `${deadline.issue_no}:${deadline.start_at}`
    : null
  useEffect(() => {
    if (!deadlineKey) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [deadlineKey])

  return { deadline, remainingSeconds }
}
