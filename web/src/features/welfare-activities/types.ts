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
export type WelfareStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'finished'

/** 所有 quota 字段为内部整数单位；issue_no 在草稿阶段为 null。 */
export interface WelfareIssue {
  id: number
  issue_no: number | null
  status: WelfareStatus
  total_quota: number
  packet_count: number
  remaining_quota: number
  remaining_count: number
  start_at: number
  claim?: WelfareClaim
}

export interface AdminWelfareIssue extends WelfareIssue {
  min_quota: number
  created_by: number
  dispatched_by?: number
  cancelled_by?: number
  cancel_reason?: string
  created_at: number
  dispatched_at: number
  finished_at: number
  updated_at: number
  cancelled_at: number
}

/** 普通用户记录不含 user_id / ledger_no；管理员接口才返回这些字段。 */
export interface WelfareClaim {
  id: number
  issue_no: number
  username: string
  quota: number
  created_at: number
  user_id?: number
  ledger_no?: string
}

export interface WelfareCurrent {
  server_time: number
  issue: WelfareIssue | null
  upcoming: WelfareIssue | null
  /** 浏览器单调时钟接收点，避免系统时钟跳变影响倒计时。 */
  receivedAt: number
}

export interface WelfarePage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface WelfareDraftPayload {
  total_quota: number
  packet_count: number
  min_quota: number
  start_at: number
}

export interface WelfareAdminAction {
  issue: AdminWelfareIssue
  kind: 'dispatch' | 'cancel' | 'delete'
}
