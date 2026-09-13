import { useLayoutEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import TabGroupSplitLayout from '../tab-group/TabGroupSplitLayout'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

export function DockedSurfaceTabs({
  worktreeId,
  groupId,
  visible
}: {
  worktreeId: string
  groupId: string
  visible: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const focusedGroupId = useAppStore((state) => state.activeGroupIdByWorktree[worktreeId])
  const position = useSidebarSurfaceDock((state) => state.position)
  useLayoutEffect(() => {
    const root = containerRef.current
    const setViewport = useSidebarSurfaceDock.getState().setViewport
    if (!root || !visible) {
      setViewport(null)
      return
    }
    const body = root.querySelector<HTMLElement>('[data-tab-group-body-id]')
    if (!body) {
      return
    }
    const update = () => {
      const rect = body.getBoundingClientRect()
      setViewport({
        groupId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      })
    }
    const observer = new ResizeObserver(update)
    observer.observe(body)
    observer.observe(document.documentElement)
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      setViewport(null)
    }
  }, [groupId, visible, position])

  return (
    <div ref={containerRef} className={visible ? 'flex min-h-0 flex-1' : 'hidden'}>
      <TabGroupSplitLayout
        layout={{ type: 'leaf', groupId }}
        worktreeId={worktreeId}
        focusedGroupId={focusedGroupId}
        isWorktreeActive={visible}
        renderDockedGroup
      />
    </div>
  )
}
