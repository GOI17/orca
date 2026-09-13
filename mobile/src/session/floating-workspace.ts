// Legacy desktop sessions can survive upgrades; retain their local-only wire identity.
export const FLOATING_WORKSPACE_WORKTREE_ID = 'global-floating-terminal'

export const FLOATING_WORKSPACE_TITLE = 'Legacy session'

export function isFloatingWorkspaceWorktreeId(worktreeId: string | null | undefined): boolean {
  return worktreeId === FLOATING_WORKSPACE_WORKTREE_ID
}
