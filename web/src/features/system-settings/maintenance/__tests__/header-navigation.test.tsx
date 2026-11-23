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
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { useTopNavLinks } from '@/hooks/use-top-nav-links'

import {
  HEADER_NAV_DEFAULT,
  serializeHeaderNavModules,
  type HeaderNavModulesConfig,
} from '../config'
import { HeaderNavigationSection } from '../header-navigation-section'

const testState = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  status: null as Record<string, unknown> | null,
}))

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({
    mutateAsync: testState.mutateAsync,
    isPending: false,
  }),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: testState.status }),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ auth: { user: null } }),
}))

function createConfig(
  customLinks: HeaderNavModulesConfig['customLinks']
): HeaderNavModulesConfig {
  return {
    ...HEADER_NAV_DEFAULT,
    pricing: { ...HEADER_NAV_DEFAULT.pricing },
    rankings: { ...HEADER_NAV_DEFAULT.rankings },
    customLinks,
  }
}

beforeEach(() => {
  testState.mutateAsync.mockReset()
  testState.mutateAsync.mockResolvedValue({ success: true })
  testState.status = null
})

describe('custom header navigation', () => {
  test('adds, edits, reorders, deletes, and saves menu items', async () => {
    const user = userEvent.setup()
    const config = createConfig([
      { name: 'Internal', url: '/internal' },
      { name: 'External', url: 'https://example.com' },
    ])
    const { container } = render(
      <HeaderNavigationSection
        config={config}
        initialSerialized={serializeHeaderNavModules(config)}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Move menu item 2 up' })
    )
    expect(
      screen
        .getAllByLabelText('Menu name')
        .map((input) => input.getAttribute('value'))
    ).toEqual(['External', 'Internal'])

    await user.click(screen.getByRole('button', { name: 'Delete menu item 2' }))
    await user.click(screen.getByRole('button', { name: 'Add menu item' }))

    const nameInputs = screen.getAllByLabelText('Menu name')
    const addressInputs = screen.getAllByLabelText('Menu address')
    await user.type(nameInputs[1], 'Support')
    await user.type(addressInputs[1], '/support')

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(testState.mutateAsync).toHaveBeenCalledTimes(1))
    const request = testState.mutateAsync.mock.calls[0][0]
    expect(request.key).toBe('HeaderNavModules')
    expect(JSON.parse(request.value).customLinks).toEqual([
      { name: 'External', url: 'https://example.com' },
      { name: 'Support', url: '/support' },
    ])
  })

  test('rejects unsafe menu addresses before saving', async () => {
    const user = userEvent.setup()
    const config = createConfig([])
    const { container } = render(
      <HeaderNavigationSection
        config={config}
        initialSerialized={serializeHeaderNavModules(config)}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Add menu item' }))
    await user.type(screen.getByLabelText('Menu name'), 'Unsafe')
    await user.type(
      screen.getByLabelText('Menu address'),
      'javascript:alert(1)'
    )
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(
      await screen.findByText(
        'Use an internal path starting with / or a full http(s) URL.'
      )
    ).toBeVisible()
    expect(testState.mutateAsync).not.toHaveBeenCalled()
  })

  test('appends configured links and marks external destinations', () => {
    testState.status = {
      HeaderNavModules: JSON.stringify({
        home: false,
        console: false,
        pricing: false,
        rankings: false,
        docs: false,
        about: false,
        customLinks: [
          { name: 'Support', url: '/support' },
          { name: 'Community', url: 'https://example.com/community' },
          { name: 'Unsafe', url: 'javascript:alert(1)' },
        ],
      }),
    }

    const { result } = renderHook(() => useTopNavLinks())

    expect(result.current).toEqual([
      {
        title: 'Support',
        href: '/support',
        external: false,
      },
      {
        title: 'Community',
        href: 'https://example.com/community',
        external: true,
      },
    ])
  })
})
