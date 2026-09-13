import React, { useEffect, useState } from 'react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { RightSidebarPanelContent } from './right-sidebar-panel-content'
import { useRightSidebarActivityItems } from './use-right-sidebar-activity-items'
import { useRightSidebarTabRouting } from './use-right-sidebar-tab-routing'
import { RightSidebarSurfaceLauncher } from './RightSidebarSurfaceLauncher'
import { RightSidebarSurfaceToolbar } from './RightSidebarSurfaceToolbar'
import { useRightSidebarSurfaceActions } from './use-right-sidebar-surface-actions'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'
import { DockedSurfaceTabs } from './DockedSurfaceTabs'
import { SidebarDockResizeHandle } from './SidebarDockResizeHandle'
import { computeMaxRightSidebarPanelWidth } from './right-sidebar-width'

function RightSidebarInner(): React.JSX.Element {
  const rightSidebarOpen = useAppStore((state) => state.rightSidebarOpen)
  const leftSidebarWidth = useAppStore((state) => (state.sidebarOpen ? state.sidebarWidth : 0))
  const rightSidebarWidth = useAppStore((state) => state.rightSidebarWidth)
  const setRightSidebarWidth = useAppStore((state) => state.setRightSidebarWidth)
  const toggleRightSidebar = useAppStore((state) => state.toggleRightSidebar)
  const storedTab = useAppStore((state) => state.rightSidebarTab)
  const routeRequestId = useAppStore((state) => state.rightSidebarRouteRequestId)
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const dockedId = useSidebarSurfaceDock((state) =>
    worktreeId ? state.groupByWorktree[worktreeId] : undefined
  )
  const groupId = useAppStore((state) =>
    worktreeId &&
    dockedId &&
    state.groupsByWorktree[worktreeId]?.some((group) => group.id === dockedId)
      ? dockedId
      : undefined
  )
  const position = useSidebarSurfaceDock((state) => state.position)
  const expanded = useSidebarSurfaceDock((state) => state.expanded)
  const height = useSidebarSurfaceDock((state) => state.height)
  const setHeight = useSidebarSurfaceDock((state) => state.setHeight)
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }))
  const [navigation, setNavigation] = useState<{
    view: 'launcher' | 'tabs' | 'panel'
    requestId: number
  }>({
    view: routeRequestId === 0 && storedTab === 'explorer' ? 'launcher' : 'panel',
    requestId: routeRequestId
  })
  const activity = useRightSidebarActivityItems({ rightSidebarOpen })
  const { effectiveTab, selectActivityTab } = useRightSidebarTabRouting(activity)
  // Explicit file/search/review commands must take precedence over the surface picker.
  const requestedView = navigation.requestId === routeRequestId ? navigation.view : 'panel'
  const view = requestedView === 'tabs' && !groupId ? 'launcher' : requestedView
  const focusMainGroup = () => {
    const state = useAppStore.getState()
    if (!worktreeId || state.activeGroupIdByWorktree[worktreeId] !== groupId) {
      return
    }
    const mainGroup = state.groupsByWorktree[worktreeId]?.find((group) => group.id !== groupId)
    if (mainGroup) {
      state.focusGroup(worktreeId, mainGroup.id)
    }
  }
  const navigate = (next: 'launcher' | 'tabs' | 'panel') => {
    if (next !== 'tabs') {
      focusMainGroup()
    }
    setNavigation({ view: next, requestId: routeRequestId })
  }
  const actions = useRightSidebarSurfaceActions(
    activity.visibleItems,
    (tab) => {
      navigate('panel')
      selectActivityTab(tab)
    },
    () => navigate('tabs')
  )

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    if (rightSidebarOpen && view === 'tabs') {
      return
    }
    const state = useAppStore.getState()
    if (!worktreeId || !groupId || state.activeGroupIdByWorktree[worktreeId] !== groupId) {
      return
    }
    const mainGroup = state.groupsByWorktree[worktreeId]?.find((group) => group.id !== groupId)
    if (mainGroup) {
      state.focusGroup(worktreeId, mainGroup.id)
    }
  }, [rightSidebarOpen, view, worktreeId, groupId])

  const bottom = position === 'bottom'
  const maxSize = bottom
    ? Math.max(160, viewport.height - 180)
    : computeMaxRightSidebarPanelWidth(viewport.width - (leftSidebarWidth ?? 0), 0)
  const size = expanded ? maxSize : Math.min(maxSize, bottom ? height : rightSidebarWidth)
  const title =
    view === 'launcher'
      ? undefined
      : view === 'tabs'
        ? translate('sidebar.surfaces.workspace', 'Workspace surfaces')
        : activity.visibleItems.find((item) => item.id === effectiveTab)?.title

  return (
    <aside
      data-sidebar-surface-panel=""
      data-dock-position={position}
      className={`relative flex shrink-0 flex-col bg-background text-foreground ${rightSidebarOpen ? (bottom ? 'border-t border-border' : 'border-l border-border') : 'overflow-hidden'}`}
      style={
        bottom
          ? { height: rightSidebarOpen ? size : 0, width: '100%' }
          : { width: rightSidebarOpen ? size : 0 }
      }
      aria-hidden={!rightSidebarOpen}
      inert={!rightSidebarOpen}
    >
      {rightSidebarOpen && (
        <>
          <RightSidebarSurfaceToolbar
            title={title}
            onHome={() => navigate('launcher')}
            onClose={() => {
              focusMainGroup()
              toggleRightSidebar()
            }}
          />
          {view === 'launcher' && <RightSidebarSurfaceLauncher actions={actions} />}
          {view === 'panel' && (
            <RightSidebarPanelContent effectiveTab={effectiveTab} rightSidebarOpen />
          )}
        </>
      )}
      {worktreeId && groupId && (
        <DockedSurfaceTabs
          worktreeId={worktreeId}
          groupId={groupId}
          visible={rightSidebarOpen && view === 'tabs'}
        />
      )}
      {rightSidebarOpen && (
        <SidebarDockResizeHandle
          bottom={bottom}
          size={size}
          maxSize={maxSize}
          onResize={(nextSize) => {
            if (expanded) {
              useSidebarSurfaceDock.getState().toggleExpanded()
            }
            if (bottom) {
              setHeight(nextSize)
            } else {
              setRightSidebarWidth(nextSize)
            }
          }}
        />
      )}
    </aside>
  )
}

export default React.memo(RightSidebarInner)
