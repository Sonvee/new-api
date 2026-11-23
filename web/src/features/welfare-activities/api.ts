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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  AdminWelfareIssue,
  WelfareClaim,
  WelfareCurrent,
  WelfareDraftPayload,
  WelfareIssue,
  WelfarePage,
} from './types'

const userPath = '/api/welfare-activities'
const adminPath = '/api/admin/welfare-activities'
interface Response<T> {
  success: boolean
  data: T
}

export const welfareKeys = {
  all: ['welfare-activities'] as const,
  current: ['welfare-activities', 'current'] as const,
  issues: ['welfare-activities', 'issues'] as const,
  admin: ['welfare-activities', 'admin'] as const,
}

export async function getWelfareCurrent(): Promise<WelfareCurrent> {
  const result = await api.get<Response<Omit<WelfareCurrent, 'receivedAt'>>>(
    `${userPath}/current`
  )
  return {
    ...requireServerSuccess(result.data).data,
    receivedAt: performance.now(),
  }
}

export async function getWelfareIssues(
  page: number
): Promise<WelfarePage<WelfareIssue>> {
  const result = await api.get<Response<WelfarePage<WelfareIssue>>>(
    `${userPath}/issues`,
    { params: { p: page, page_size: 50 } }
  )
  return requireServerSuccess(result.data).data
}

export async function getAdminWelfareIssues(
  page: number,
  pageSize: number
): Promise<WelfarePage<AdminWelfareIssue>> {
  const result = await api.get<Response<WelfarePage<AdminWelfareIssue>>>(
    adminPath,
    { params: { p: page, page_size: pageSize } }
  )
  return requireServerSuccess(result.data).data
}

export async function getWelfareClaims(
  issueNo: number,
  page: number,
  pageSize: number,
  admin: boolean
): Promise<WelfarePage<WelfareClaim>> {
  const result = await api.get<Response<WelfarePage<WelfareClaim>>>(
    `${admin ? adminPath : userPath}/issues/${issueNo}/claims`,
    { params: { p: page, page_size: pageSize } }
  )
  return requireServerSuccess(result.data).data
}

/** 领取绑定屏幕显示的期号，响应丢失后重试仍返回原领取记录，不领取新期。 */
export async function claimWelfareIssue(
  issueNo: number
): Promise<{ claim: WelfareClaim; already_claimed: boolean }> {
  const result = await api.post<
    Response<{ claim: WelfareClaim; already_claimed: boolean }>
  >(`${userPath}/current/claim`, { issue_no: issueNo })
  return requireServerSuccess(result.data).data
}

export async function saveWelfareDraft(
  payload: WelfareDraftPayload,
  id?: number
): Promise<AdminWelfareIssue> {
  const result = id
    ? await api.put<Response<AdminWelfareIssue>>(
        `${adminPath}/drafts/${id}`,
        payload
      )
    : await api.post<Response<AdminWelfareIssue>>(
        `${adminPath}/drafts`,
        payload
      )
  return requireServerSuccess(result.data).data
}

export async function runWelfareAction(
  id: number,
  action: 'dispatch' | 'cancel' | 'delete'
): Promise<void> {
  const result =
    action === 'delete'
      ? await api.delete(`${adminPath}/drafts/${id}`)
      : await api.post(
          action === 'dispatch'
            ? `${adminPath}/drafts/${id}/dispatch`
            : `${adminPath}/${id}/cancel`,
          {}
        )
  requireServerSuccess(result.data)
}
