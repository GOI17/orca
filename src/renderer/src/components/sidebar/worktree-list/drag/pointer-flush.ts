import type React from 'react'
import type { WorkspaceStatus } from '../../../../../../shared/worktree/types'
import { updateSidebarDragPreviewPosition } from '../../worktree-sidebar-pointer-drag-dom'
import { getPointerDropStatusTarget, shouldPreferSidebarStatusDropTarget } from './status-target'
import type { WorktreeDropCommitContext } from './drop-commit-context'
import {
  applyWorktreeDropPreview,
  clearWorktreeDropPreview,
  NO_WORKTREE_SIDEBAR_DROP_TARGET,
  updateLatestWorktreeStatusDropTarget,
  type WorktreePointerDrag,
  type WorktreeRowDragState,
  type WorktreeSidebarLineageDropTarget
} from './row-state'

export type WorktreePointerDragFrameArgs = {
  drag: WorktreePointerDrag
  ctx: WorktreeDropCommitContext
  setWorktreeDragState: React.Dispatch<React.SetStateAction<WorktreeRowDragState>>
  setDragOverStatus: (status: WorkspaceStatus | null) => void
  setPinDragOver: (pinDragOver: boolean) => void
}

// Reflect a status/pin hover that has no insertion line of its own.
function showStatusHoverWithoutInsertionLine(
  args: WorktreePointerDragFrameArgs,
  target: WorktreeSidebarLineageDropTarget
): void {
  const { drag, ctx } = args
  const statusDrop = target.status
    ? ctx.computeWorktreeStatusDrop({
        pointerY: drag.currentY,
        status: target.status,
        draggedIds: drag.reorderDraggedIds
      })
    : null
  updateLatestWorktreeStatusDropTarget(drag, target, statusDrop)
  if (statusDrop) {
    args.setDragOverStatus(null)
    args.setPinDragOver(false)
    args.setWorktreeDragState((prev) =>
      applyWorktreeDropPreview(prev, statusDrop, {
        pointerY: drag.currentY,
        matchPointerY: true
      })
    )
    return
  }
  args.setDragOverStatus(target.status)
  args.setPinDragOver(target.isPinDrop)
  args.setWorktreeDragState((prev) =>
    clearWorktreeDropPreview(prev, { pointerY: drag.currentY, matchPointerY: true })
  )
}

export function flushWorktreePointerDragFrame(args: WorktreePointerDragFrameArgs): void {
  const { drag, ctx } = args
  drag.frameId = null
  if (!drag.active || !drag.preview) {
    return
  }
  updateSidebarDragPreviewPosition({
    preview: drag.preview,
    pointerX: drag.currentX,
    pointerY: drag.currentY,
    offsetX: drag.previewOffsetX,
    offsetY: drag.previewOffsetY
  })
  if (!ctx.refreshWorktreeDragSession()) {
    ctx.clearWorktreeDrag()
    return
  }
  const sidebarContainer = ctx.scrollRef.current
  const preferredStatusTarget = ctx.getEligibleLineageDropTarget(
    sidebarContainer
      ? getPointerDropStatusTarget({
          container: sidebarContainer,
          x: drag.currentX,
          y: drag.currentY
        })
      : NO_WORKTREE_SIDEBAR_DROP_TARGET,
    drag.draggedIds
  )
  if (preferredStatusTarget.lineageParentId) {
    updateLatestWorktreeStatusDropTarget(drag, preferredStatusTarget, null)
    args.setDragOverStatus(null)
    args.setPinDragOver(false)
    args.setWorktreeDragState((prev) =>
      clearWorktreeDropPreview(prev, { pointerY: drag.currentY, matchPointerY: true })
    )
    return
  }
  if (
    shouldPreferSidebarStatusDropTarget({
      sourceGroupKey: drag.sourceGroupKey,
      target: preferredStatusTarget,
      workspaceStatuses: ctx.workspaceStatuses
    })
  ) {
    showStatusHoverWithoutInsertionLine(args, preferredStatusTarget)
    return
  }

  const drop = ctx.computeWorktreeDrop(drag.currentY)
  if (!drop) {
    showStatusHoverWithoutInsertionLine(args, preferredStatusTarget)
    return
  }
  drag.latestStatusDropTarget = null
  args.setDragOverStatus(null)
  args.setPinDragOver(false)
  args.setWorktreeDragState((prev) =>
    applyWorktreeDropPreview(prev, drop, { pointerY: drag.currentY, matchPointerY: true })
  )
}
