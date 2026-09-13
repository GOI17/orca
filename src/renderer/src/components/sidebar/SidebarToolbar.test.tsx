// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SidebarToolbar from './SidebarToolbar'

vi.mock('./SidebarSettingsHelpMenu', () => ({
  SidebarSettingsHelpMenu: () => <button type="button">Settings</button>
}))

afterEach(cleanup)

it('keeps settings accessible without retired workspace controls', () => {
  render(<SidebarToolbar />)
  expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: /workspace board|reveal active workspace/i })
  ).toBeNull()
})
