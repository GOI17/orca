import { Suspense, useMemo } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import { useDroppable } from '@dnd-kit/core'
import { useAppStore } from '../../store'

import { TabBarQuickCommandsButton } from '../tab-bar/TabBarQuickCommandsButton'
import { useWorkspaceQuickCommandTarget } from './use-workspace-quick-command-target'
import { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'
import { WorkspaceToolbarTitle } from './WorkspaceToolbarTitle'
import { getTabPaneBodyDroppableId } from './useTabDragSplit'
import { tabGroupBodyAnchorName } from './tab-group-body-anchor'
import { translate } from '@/i18n/i18n'

const EditorPanel = lazy(() => import('../editor/EditorPanel'))

export default function TabGroupPanel({
  groupId,
  worktreeId,
  isVisible,
  isFocused,
  hasSplitGroups,
  touchesRightEdge,
  touchesLeftEdge,
  touchesBottomEdge = false,
  suppressLeftBorder = false,
  suppressRightBorder = false,
  suppressBottomBorder = false,
  reserveClosedExplorerToggleSpace,
  reserveCollapsedSidebarHeaderSpace,
  isTabDragActive = false
}: {
  groupId: string
  worktreeId: string
  isVisible: boolean
  isFocused: boolean
  hasSplitGroups: boolean
  touchesRightEdge: boolean
  touchesLeftEdge: boolean
  touchesBottomEdge?: boolean
  suppressLeftBorder?: boolean
  suppressRightBorder?: boolean
  suppressBottomBorder?: boolean
  reserveClosedExplorerToggleSpace: boolean
  reserveCollapsedSidebarHeaderSpace: boolean
  isTabDragActive?: boolean
}): React.JSX.Element {
  const rightSidebarOpen = useAppStore((state) => state.rightSidebarOpen)
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const model = useTabGroupWorkspaceModel({ groupId, worktreeId })
  const { activeTab, commands } = model
  const { setNodeRef: setBodyDropRef } = useDroppable({
    id: getTabPaneBodyDroppableId(groupId),
    data: {
      kind: 'pane-body',
      groupId,
      worktreeId
    },
    disabled: !isTabDragActive
  })
  // Why: per-group anchor-name lets the worktree-level overlay position panes via CSS anchor positioning, so moving a tab between groups re-targets the anchor instead of remounting xterm (loses alt-screen TUI state) or reloading `<webview>`.
  const bodyAnchorName = tabGroupBodyAnchorName(groupId)
  // Why: memoize so a fresh style object each render doesn't break downstream memoization keyed on referential equality.
  const bodyAnchorStyle = useMemo(
    () => ({ anchorName: bodyAnchorName }) as React.CSSProperties,
    [bodyAnchorName]
  )

  const quickCommandTarget = useWorkspaceQuickCommandTarget(worktreeId, groupId, isVisible)
  const focusPanelFromEvent = (event: React.SyntheticEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    // Command clicks must not change the run target to the strip hosting the button.
    if (
      event.currentTarget.contains(target) &&
      !target.closest('[data-workspace-quick-commands]')
    ) {
      commands.focusGroup()
    }
  }
  return (
    <div
      // Why: vertical borders stay `border-border` so the focus highlight (--accent ~#f5f5f5 in light) doesn't paint a near-white strip by the resize handle; only the bottom border changes on focus.
      // Why: unfocused split groups dim subtly so the focused one reads as selected; only when hasSplitGroups since a lone group has nothing to contrast against.
      className={`group/tab-group relative flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden${
        hasSplitGroups
          ? // Why: skip border-l/border-r on edge-touching groups; the split-layout wrapper and right sidebar already paint borders at those seams (double line otherwise).
            ` ${
              touchesLeftEdge || suppressLeftBorder ? '' : 'border-l'
            } ${touchesRightEdge || suppressRightBorder ? '' : 'border-r'} ${
              touchesBottomEdge || suppressBottomBorder ? '' : 'border-b'
            } border-border ${
              isFocused && !touchesBottomEdge && !suppressBottomBorder ? 'border-b-accent' : ''
            } ${isFocused ? '' : 'opacity-95'}`
          : ''
      }`}
      onPointerDown={focusPanelFromEvent}
      // Why: keyboard/AT focus can enter a split group without a pointer event, so sync group focus to DOM focus for global shortcuts.
      onFocusCapture={focusPanelFromEvent}
    >
      {/* Why: macOS hiddenInset titleBarStyle makes -webkit-app-region: drag the only way to move the window from the toolbar. */}
      <div
        className="h-[32px] shrink-0 border-b border-border bg-card"
        data-tab-group-strip-id={groupId}
        data-terminal-focus-release-surface="true"
        data-worktree-id={worktreeId}
      >
        <div className="flex h-full items-stretch pr-1.5">
          {/* Why: Electron drag hit-test respects no-drag only on DOM descendants, not z-index siblings, so this no-drag spacer keeps the collapsed left-sidebar's floating toggle clickable. */}
          {reserveCollapsedSidebarHeaderSpace && !sidebarOpen ? (
            <div
              className="shrink-0"
              style={
                {
                  width: 'var(--collapsed-sidebar-header-width)',
                  WebkitAppRegion: 'no-drag'
                } as React.CSSProperties
              }
            />
          ) : null}
          <WorkspaceToolbarTitle worktreeId={worktreeId} />
          <div
            className="ml-1.5 flex shrink-0 items-center gap-0.5"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {quickCommandTarget ? (
              <div data-workspace-quick-commands="" className="flex shrink-0 items-center">
                <TabBarQuickCommandsButton worktreeId={worktreeId} groupId={quickCommandTarget} />
              </div>
            ) : null}
          </div>
          {/* Why: Electron drag hit-test respects no-drag only on DOM descendants, not z-index siblings, so this no-drag spacer keeps the floating right-sidebar toggle + window controls clickable. */}
          {reserveClosedExplorerToggleSpace && !rightSidebarOpen ? (
            <div
              className="shrink-0"
              style={
                {
                  width: 'calc(84px + var(--window-controls-width, 0px))',
                  WebkitAppRegion: 'no-drag'
                } as React.CSSProperties
              }
            />
          ) : null}
        </div>
      </div>

      <div
        ref={setBodyDropRef}
        data-tab-group-body-id={groupId}
        data-worktree-id={worktreeId}
        className="relative flex-1 min-h-0 overflow-hidden"
        style={bodyAnchorStyle}
      >
        {/* Why: empty anchor so the agent-sessions tour reads as a terminal-area tip, not toolbar chrome. */}
        {isFocused ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-1/4 h-px"
            data-contextual-tour-target="workspace-agent-terminal-tip"
          />
        ) : null}
        {activeTab &&
          activeTab.contentType !== 'terminal' &&
          activeTab.contentType !== 'agent-session' &&
          activeTab.contentType !== 'browser' &&
          activeTab.contentType !== 'simulator' && (
            <div className="absolute inset-0 flex min-h-0 min-w-0">
              {/* Why: split groups render editor content in a plain relative pane body, not the legacy Terminal.tsx flex column. */}
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    {translate(
                      'auto.components.tab.group.TabGroupPanel.814fb04c43',
                      'Loading editor...'
                    )}
                  </div>
                }
              >
                <EditorPanel
                  activeFileId={activeTab.entityId}
                  activeViewStateId={activeTab.id}
                  isVisible={isVisible}
                  isCmdSaveOwner={isFocused}
                />
              </Suspense>
            </div>
          )}

        {/* Why: terminal/browser/simulator/structured-chat panes render at the worktree level; tab activation only changes overlay visibility and never remounts a live surface. */}
      </div>
    </div>
  )
}
