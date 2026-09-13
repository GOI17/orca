export function clearRetiredWorkspaceLayout(): void {
  try {
    for (const key of [
      'orca-floating-terminal-panel-bounds-v1',
      'orca-floating-terminal-panel-view-state-v1',
      'orca-floating-terminal-trigger-position-v2'
    ]) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Storage may be unavailable; obsolete layout must never block startup.
  }
}
