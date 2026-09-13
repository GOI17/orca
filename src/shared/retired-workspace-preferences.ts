const RETIRED_WORKSPACE_PREFERENCES = [
  'floatingTerminalEnabled',
  'floatingTerminalDefaultedForAllUsers',
  'floatingTerminalCwd',
  'floatingTerminalTrustedCwds',
  'floatingTerminalCwdMigratedToAppWorkspace',
  'floatingTerminalTriggerLocation',
  'workspaceBoardOpacity',
  'workspaceBoardColumnWidth',
  'syncTaskStatusFromWorkspaceBoard'
] as const

/** Old profiles and paired clients can still supply retired preference keys. */
export function stripRetiredWorkspacePreferences<T extends object>(value: T): T {
  const preferences = { ...value }
  for (const key of RETIRED_WORKSPACE_PREFERENCES) {
    Reflect.deleteProperty(preferences, key)
  }
  return preferences
}
