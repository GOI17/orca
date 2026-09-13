import { useAppStore } from '@/store'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

export function ensureSidebarSurfaceGroup(worktreeId: string, bottom = false): string {
  const store = useAppStore.getState()
  const dock = useSidebarSurfaceDock.getState()
  const dockedId = (bottom ? dock.terminalGroupByWorktree : dock.groupByWorktree)[worktreeId]
  if (dockedId && store.groupsByWorktree[worktreeId]?.some((group) => group.id === dockedId)) {
    return dockedId
  }
  const rootId = store.ensureWorktreeRootGroup(worktreeId)
  const groupId = store.createEmptySplitGroup(worktreeId, rootId, bottom ? 'down' : 'right')
  if (!groupId) {
    throw new Error('Could not open the surface panel.')
  }
  useSidebarSurfaceDock.getState().setGroup(worktreeId, groupId, bottom)
  return groupId
}
