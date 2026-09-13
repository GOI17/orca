export type AutoAckTabTarget = { tabId: string; worktreeId: string | null }

export function resolveAutoAckTabTargets(state: {
  activeView: string
  activeTabId: string | null
  activeWorktreeId: string | null
}): AutoAckTabTarget[] {
  return state.activeView === 'terminal' && state.activeTabId
    ? [{ tabId: state.activeTabId, worktreeId: state.activeWorktreeId }]
    : []
}
