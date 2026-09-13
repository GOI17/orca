import { create } from 'zustand'
import type { CSSProperties } from 'react'

export type SidebarDockPosition = 'right' | 'bottom'
type SurfaceViewport = { groupId: string; left: number; top: number; width: number; height: number }

// Docking is client presentation; the host still owns ordinary tab groups and their sessions.
export const useSidebarSurfaceDock = create<{
  position: SidebarDockPosition
  expanded: boolean
  height: number
  groupByWorktree: Record<string, string>
  viewport: SurfaceViewport | null
  setPosition: (position: SidebarDockPosition) => void
  toggleExpanded: () => void
  setHeight: (height: number) => void
  setGroup: (worktreeId: string, groupId: string) => void
  setViewport: (viewport: SurfaceViewport | null) => void
}>((set) => ({
  position: 'right',
  expanded: false,
  height: 320,
  groupByWorktree: {},
  viewport: null,
  setPosition: (position) => set({ position, expanded: false }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  setHeight: (height) => set({ height }),
  setGroup: (worktreeId, groupId) =>
    set((state) => ({ groupByWorktree: { ...state.groupByWorktree, [worktreeId]: groupId } })),
  setViewport: (viewport) =>
    set((state) => {
      const previous = state.viewport
      if (
        previous?.groupId === viewport?.groupId &&
        previous?.left === viewport?.left &&
        previous?.top === viewport?.top &&
        previous?.width === viewport?.width &&
        previous?.height === viewport?.height
      ) {
        return state
      }
      return { viewport }
    })
}))

export function useDockedSurfaceStyle(groupId: string | undefined): CSSProperties | undefined {
  const isDocked = useSidebarSurfaceDock((state) =>
    Boolean(groupId && Object.values(state.groupByWorktree).includes(groupId))
  )
  const viewport = useSidebarSurfaceDock((state) =>
    state.viewport?.groupId === groupId ? state.viewport : null
  )
  if (!isDocked) {
    return undefined
  }
  // Fixed geometry escapes the center column's clipping without reparenting a live webview.
  return {
    position: 'fixed',
    positionAnchor: 'none',
    top: viewport?.top ?? 0,
    left: viewport?.left ?? 0,
    width: viewport?.width ?? 0,
    height: viewport?.height ?? 0,
    zIndex: 10,
    ...(!viewport ? { display: 'none' } : {})
  }
}

export function useDockedSurfaceVisibility(groupId: string | undefined): boolean {
  return useSidebarSurfaceDock(
    (state) =>
      !groupId ||
      !Object.values(state.groupByWorktree).includes(groupId) ||
      state.viewport?.groupId === groupId
  )
}
