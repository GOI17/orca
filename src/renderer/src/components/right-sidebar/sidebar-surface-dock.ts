import { create } from 'zustand'
import type { CSSProperties } from 'react'

type SurfaceViewport = { groupId: string; left: number; top: number; width: number; height: number }

// Docking is client presentation; the host still owns ordinary tab groups and their sessions.
export const useSidebarSurfaceDock = create<{
  expanded: boolean
  height: number
  groupByWorktree: Record<string, string>
  terminalGroupByWorktree: Record<string, string>
  terminalOpen: boolean
  terminalPending: boolean
  viewports: Record<string, SurfaceViewport | undefined>
  toggleExpanded: () => void
  setHeight: (height: number) => void
  setGroup: (worktreeId: string, groupId: string, bottom?: boolean) => void
  setViewport: (groupId: string, viewport: SurfaceViewport | null) => void
}>((set) => ({
  expanded: false,
  height: 320,
  groupByWorktree: {},
  terminalGroupByWorktree: {},
  terminalOpen: false,
  terminalPending: false,
  viewports: {},
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
  setHeight: (height) => set({ height }),
  setGroup: (worktreeId, groupId, bottom = false) =>
    set((state) =>
      bottom
        ? { terminalGroupByWorktree: { ...state.terminalGroupByWorktree, [worktreeId]: groupId } }
        : { groupByWorktree: { ...state.groupByWorktree, [worktreeId]: groupId } }
    ),
  setViewport: (groupId, viewport) =>
    set((state) => {
      const previous = state.viewports[groupId]
      if (
        previous?.groupId === viewport?.groupId &&
        previous?.left === viewport?.left &&
        previous?.top === viewport?.top &&
        previous?.width === viewport?.width &&
        previous?.height === viewport?.height
      ) {
        return state
      }
      return { viewports: { ...state.viewports, [groupId]: viewport ?? undefined } }
    })
}))

export function useDockedSurfaceStyle(groupId: string | undefined): CSSProperties | undefined {
  const isDocked = useSidebarSurfaceDock((state) =>
    Boolean(
      groupId &&
      [
        ...Object.values(state.groupByWorktree),
        ...Object.values(state.terminalGroupByWorktree)
      ].includes(groupId)
    )
  )
  const viewport = useSidebarSurfaceDock((state) =>
    groupId ? state.viewports[groupId] : undefined
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
      ![
        ...Object.values(state.groupByWorktree),
        ...Object.values(state.terminalGroupByWorktree)
      ].includes(groupId) ||
      Boolean(state.viewports[groupId])
  )
}
