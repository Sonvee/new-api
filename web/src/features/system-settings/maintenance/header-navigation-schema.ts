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
import * as z from 'zod'

import { isHeaderNavUrl } from '@/lib/header-navigation-links'

const customHeaderNavItemSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  url: z
    .string()
    .trim()
    .min(1, 'Required')
    .refine(
      isHeaderNavUrl,
      'Use an internal path starting with / or a full http(s) URL.'
    ),
})

export const headerNavSchema = z.object({
  home: z.boolean(),
  console: z.boolean(),
  pricingEnabled: z.boolean(),
  pricingRequireAuth: z.boolean(),
  rankingsEnabled: z.boolean(),
  rankingsRequireAuth: z.boolean(),
  docs: z.boolean(),
  about: z.boolean(),
  customLinks: z.array(customHeaderNavItemSchema),
})

export type HeaderNavFormValues = z.infer<typeof headerNavSchema>
