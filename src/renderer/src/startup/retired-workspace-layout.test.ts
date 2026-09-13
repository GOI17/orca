import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearRetiredWorkspaceLayout } from './retired-workspace-layout'

afterEach(() => vi.unstubAllGlobals())

describe('retired workspace layout', () => {
  it('removes only obsolete panel layout from an existing profile', () => {
    const values = new Map([
      ['orca-floating-terminal-panel-bounds-v1', '{}'],
      ['orca-floating-terminal-panel-view-state-v1', '{}'],
      ['orca-floating-terminal-trigger-position-v2', '{}'],
      ['current-workspace', 'folder:notes']
    ])
    vi.stubGlobal('window', { localStorage: { removeItem: (key: string) => values.delete(key) } })
    clearRetiredWorkspaceLayout()
    expect([...values]).toEqual([['current-workspace', 'folder:notes']])
  })

  it('does not block startup when browser storage is unavailable', () => {
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Storage unavailable')
      }
    })
    expect(clearRetiredWorkspaceLayout).not.toThrow()
  })
})
