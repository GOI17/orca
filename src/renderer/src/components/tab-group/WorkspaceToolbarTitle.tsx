import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { resolveWorktreeDisplayName } from '@/lib/worktree-default-display-name'
import { useAppStore } from '@/store'
import { useProjectHostSetupProjection, useRepoById, useWorktreeById } from '@/store/selectors'

export function WorkspaceToolbarTitle({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const worktree = useWorktreeById(worktreeId)
  const repo = useRepoById(worktree?.repoId ?? null)
  const { projects } = useProjectHostSetupProjection()
  const scope = parseWorkspaceKey(worktreeId)
  const folder = useAppStore((state) =>
    scope?.type === 'folder'
      ? state.folderWorkspaces.find((entry) => entry.id === scope.folderWorkspaceId)
      : undefined
  )
  const folderProjectName = useAppStore((state) =>
    folder
      ? state.projectGroups.find((group) => group.id === folder.projectGroupId)?.name
      : undefined
  )
  const project = projects.find(
    (entry) =>
      entry.id === worktree?.projectId || (repo !== null && entry.sourceRepoIds.includes(repo.id))
  )
  const projectName = folderProjectName ?? project?.displayName ?? repo?.displayName
  const workspaceTitle = folder?.name ?? (worktree ? resolveWorktreeDisplayName(worktree) : '')

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-[13px]">
      {projectName ? (
        <>
          <span className="max-w-1/2 truncate text-muted-foreground">{projectName}</span>
          {workspaceTitle ? <span className="shrink-0 text-muted-foreground">→</span> : null}
        </>
      ) : null}
      <span className="min-w-0 truncate text-foreground">{workspaceTitle}</span>
    </div>
  )
}
