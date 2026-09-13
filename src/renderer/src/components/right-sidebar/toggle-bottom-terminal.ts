import { useAppStore } from '@/store'
import { ensureSidebarSurfaceGroup } from './sidebar-surface-creation'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

export async function toggleBottomTerminal(): Promise<void> {
  const dock = useSidebarSurfaceDock.getState()
  const state = useAppStore.getState()
  const worktreeId = state.activeWorktreeId
  if (!worktreeId || dock.terminalPending) {
    return
  }
  const groupId = dock.terminalGroupByWorktree[worktreeId]
  const hasGroup = state.groupsByWorktree[worktreeId]?.some((group) => group.id === groupId)
  if (dock.terminalOpen && hasGroup) {
    useSidebarSurfaceDock.setState({ terminalOpen: false })
    return
  }
  // Remote creation can take time; share the pending guard across all toolbar instances.
  useSidebarSurfaceDock.setState({ terminalPending: true })
  try {
    const groupId = ensureSidebarSurfaceGroup(worktreeId, true)
    const existing = useAppStore
      .getState()
      .unifiedTabsByWorktree[worktreeId]?.find(
        (tab) => tab.groupId === groupId && tab.contentType === 'terminal'
      )
    if (existing) {
      useAppStore.getState().activateTab(existing.id)
    } else {
      await state.openNewTerminalTabInActiveWorkspace(groupId)
    }
    if (useAppStore.getState().activeWorktreeId === worktreeId) {
      useSidebarSurfaceDock.setState({ terminalOpen: true, expanded: false })
    }
  } finally {
    useSidebarSurfaceDock.setState({ terminalPending: false })
  }
}
