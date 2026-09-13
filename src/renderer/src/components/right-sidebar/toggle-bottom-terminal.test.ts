import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

const state = vi.hoisted(() => ({
  activeWorktreeId: 'ssh-worktree' as string | null,
  groupsByWorktree: { 'ssh-worktree': [{ id: 'bottom-group' }] } as Record<
    string,
    { id: string }[]
  >,
  unifiedTabsByWorktree: {} as Record<
    string,
    { id: string; groupId: string; contentType: string }[]
  >,
  activateTab: vi.fn(),
  openNewTerminalTabInActiveWorkspace: vi.fn()
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => state } }))
vi.mock('./sidebar-surface-creation', () => ({ ensureSidebarSurfaceGroup: () => 'bottom-group' }))
import { toggleBottomTerminal } from './toggle-bottom-terminal'

describe('bottom terminal toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.activeWorktreeId = 'ssh-worktree'
    state.unifiedTabsByWorktree = {}
    useSidebarSurfaceDock.setState({
      terminalOpen: false,
      terminalPending: false,
      expanded: false,
      terminalGroupByWorktree: { 'ssh-worktree': 'bottom-group' }
    })
  })

  it('reopens the existing terminal without creating another session', async () => {
    state.unifiedTabsByWorktree['ssh-worktree'] = [
      { id: 'remote-terminal', groupId: 'bottom-group', contentType: 'terminal' }
    ]
    await toggleBottomTerminal()
    expect(useSidebarSurfaceDock.getState().terminalOpen).toBe(true)
    await toggleBottomTerminal()
    expect(useSidebarSurfaceDock.getState().terminalOpen).toBe(false)
    await toggleBottomTerminal()
    expect(state.activateTab).toHaveBeenLastCalledWith('remote-terminal')
    expect(state.openNewTerminalTabInActiveWorkspace).not.toHaveBeenCalled()
  })

  it('deduplicates slow host creation and ignores a completed request after workspace changes', async () => {
    let finish!: () => void
    state.openNewTerminalTabInActiveWorkspace.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const opening = toggleBottomTerminal()
    await toggleBottomTerminal()
    expect(state.openNewTerminalTabInActiveWorkspace).toHaveBeenCalledTimes(1)
    state.activeWorktreeId = 'another-worktree'
    finish()
    await opening
    expect(useSidebarSurfaceDock.getState().terminalOpen).toBe(false)
    expect(useSidebarSurfaceDock.getState().terminalPending).toBe(false)
  })

  it('allows retry after a host failure', async () => {
    state.openNewTerminalTabInActiveWorkspace.mockRejectedValueOnce(new Error('Host unavailable'))
    await expect(toggleBottomTerminal()).rejects.toThrow('Host unavailable')
    expect(useSidebarSurfaceDock.getState().terminalOpen).toBe(false)
    expect(useSidebarSurfaceDock.getState().terminalPending).toBe(false)
    state.openNewTerminalTabInActiveWorkspace.mockResolvedValueOnce(undefined)
    await toggleBottomTerminal()
    expect(useSidebarSurfaceDock.getState().terminalOpen).toBe(true)
  })
})
