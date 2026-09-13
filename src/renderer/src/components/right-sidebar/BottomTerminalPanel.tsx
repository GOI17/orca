import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store'
import { DockedSurfaceTabs } from './DockedSurfaceTabs'
import { SidebarDockResizeHandle } from './SidebarDockResizeHandle'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

export function BottomTerminalPanel({ available }: { available: boolean }) {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const rightOpen = useAppStore((state) => state.rightSidebarOpen)
  const expanded = useSidebarSurfaceDock((state) => state.expanded)
  const open = useSidebarSurfaceDock((state) => state.terminalOpen)
  const height = useSidebarSurfaceDock((state) => state.height)
  const setHeight = useSidebarSurfaceDock((state) => state.setHeight)
  const dockedId = useSidebarSurfaceDock((state) =>
    worktreeId ? state.terminalGroupByWorktree[worktreeId] : undefined
  )
  const groupId = useAppStore((state) =>
    worktreeId && state.groupsByWorktree[worktreeId]?.some((group) => group.id === dockedId)
      ? dockedId
      : undefined
  )
  const visible = available && open && !(rightOpen && expanded) && Boolean(groupId)
  const rootRef = useRef<HTMLElement>(null)
  const [maxSize, setMaxSize] = useState(320)
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!parent) {
      return
    }
    const update = () => setMaxSize(Math.max(160, parent.clientHeight - 160))
    const observer = new ResizeObserver(update)
    observer.observe(parent)
    update()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (visible || !worktreeId || !groupId) {
      return
    }
    const state = useAppStore.getState()
    if (state.activeGroupIdByWorktree[worktreeId] !== groupId) {
      return
    }
    const rightGroupId = useSidebarSurfaceDock.getState().groupByWorktree[worktreeId]
    const main = state.groupsByWorktree[worktreeId]?.find(
      (group) => group.id !== groupId && group.id !== rightGroupId
    )
    if (main) {
      state.focusGroup(worktreeId, main.id)
    }
  }, [visible, worktreeId, groupId])
  const size = Math.min(height, maxSize)
  return (
    <section
      ref={rootRef}
      data-bottom-terminal-panel=""
      className={`relative flex shrink-0 flex-col bg-background ${visible ? 'border-t border-border' : 'overflow-hidden'}`}
      style={{ height: visible ? size : 0 }}
      aria-hidden={!visible}
      inert={!visible}
    >
      {worktreeId && groupId && (
        <DockedSurfaceTabs worktreeId={worktreeId} groupId={groupId} visible={visible} />
      )}
      {visible && (
        <SidebarDockResizeHandle bottom size={size} maxSize={maxSize} onResize={setHeight} />
      )}
    </section>
  )
}
