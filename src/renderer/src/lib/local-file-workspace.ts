import { useAppStore } from '@/store'
import { findWorkspaceFileRoute } from './runtime-workspace-file-route'
import { activateAndRevealWorkspace } from './worktree-activation'
import { basename } from './path'
import { resolveRuntimePath } from '../../../shared/cross-platform-path'
import { detectLanguage } from './language-detect'
import { folderWorkspaceKey } from '../../../shared/workspace-scope'

/** Native file requests always belong to this machine, even while an SSH workspace is active. */
export async function openLocalFileInWorkspace(filePath: string): Promise<string> {
  const store = useAppStore.getState()
  let route = findWorkspaceFileRoute(store, 'local', filePath)
  if (!route) {
    const folderPath = resolveRuntimePath(filePath, '..')
    const name = basename(folderPath) || folderPath
    const group = await store.createProjectGroup(name, { activeRuntimeEnvironmentId: null })
    if (!group) {
      throw new Error('Could not create a local project for this file.')
    }
    const workspace = await store.createFolderWorkspace(
      { projectGroupId: group.id, name, folderPath, connectionId: null },
      { runtimeEnvironmentId: null }
    )
    if (!workspace) {
      throw new Error('Could not create a local workspace for this file.')
    }
    route = {
      worktreeId: folderWorkspaceKey(workspace.id),
      relativePath: basename(filePath),
      executionHostId: 'local'
    }
  }
  const activated = activateAndRevealWorkspace(route.worktreeId, {
    executionHostId: 'local',
    providesInitialSurface: true
  })
  if (!activated) {
    throw new Error('Could not activate the local workspace for this file.')
  }
  return useAppStore.getState().openFile(
    {
      filePath,
      relativePath: route.relativePath,
      worktreeId: route.worktreeId,
      language: detectLanguage(filePath),
      mode: 'edit',
      runtimeEnvironmentId: null
    },
    { preview: false, suppressActiveRuntimeFallback: true }
  )
}
