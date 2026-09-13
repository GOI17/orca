import { useAppStore } from '@/store'
import { useSidebarSurfaceDock } from '../right-sidebar/sidebar-surface-dock'

export function useWorkspaceQuickCommandTarget(
  worktreeId: string,
  groupId: string,
  isVisible: boolean
): string | null {
  const rightGroupId = useSidebarSurfaceDock((state) => state.groupByWorktree[worktreeId])
  const bottomGroupId = useSidebarSurfaceDock((state) => state.terminalGroupByWorktree[worktreeId])
  return useAppStore((state) => {
    if (!isVisible) {
      return null
    }
    const groups = state.groupsByWorktree[worktreeId]
    const activeId = state.activeGroupIdByWorktree[worktreeId]
    // Keep one command control in the main strip while execution follows the active group.
    const ownerId =
      groups?.find((group) => group.id !== rightGroupId && group.id !== bottomGroupId)?.id ??
      activeId
    if (ownerId !== groupId) {
      return null
    }
    return groups?.some((group) => group.id === activeId) ? activeId : groupId
  })
}
