import { useMemo, useState } from 'react'
import type { Worktree } from '../../../../shared/worktree/types'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'

export function useWorktreeContextTarget(
  rowWorktree: Worktree,
  selectedWorktrees: readonly Worktree[] | undefined,
  menuOpen: boolean
) {
  const defaultSelection = useMemo(() => [rowWorktree], [rowWorktree])
  const effectiveSelectedWorktrees = selectedWorktrees ?? defaultSelection
  const [target, setTarget] = useState({
    worktree: rowWorktree,
    selection: effectiveSelectedWorktrees
  })
  const captureContextWorktrees = (selection: readonly Worktree[]): void => {
    // An unrelated selection must not turn this right-click into a batch action.
    const includesTarget = selection.some(
      (item) => getWorktreeHostIdentity(item) === getWorktreeHostIdentity(rowWorktree)
    )
    setTarget({ worktree: rowWorktree, selection: includesTarget ? selection : [rowWorktree] })
  }
  // A reused row must not retarget an already-open menu to another workspace or host.
  return {
    worktree: menuOpen ? target.worktree : rowWorktree,
    activeContextWorktrees: menuOpen ? target.selection : effectiveSelectedWorktrees,
    effectiveSelectedWorktrees,
    captureContextWorktrees
  }
}
