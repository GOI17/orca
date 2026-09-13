import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getAllWorktreesFromState } from '@/store/selectors'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-client'
import { getRepoHostIdentity } from '@/store/slices/repo-host-identity'
import type { AppState } from '@/store/types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  getRepoExecutionHostId,
  getRepoSshConnectionId,
  parseExecutionHostId
} from '../../../../shared/execution-host'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { mapSettledWithConcurrency } from '../../../../shared/map-with-concurrency'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import { runWorktreeBatchDelete } from './delete-worktree-flow'
import { toWorktreeDeleteIdentities } from './worktree-delete-request'

export async function findCleanProjectWorktrees(
  repo: Repo,
  state: Pick<AppState, 'repos' | 'worktreesByRepo'>
): Promise<{ clean: Worktree[]; unchecked: number }> {
  const clean: Worktree[] = []
  let unchecked = 0
  if (!isGitRepoKind(repo)) {
    return { clean, unchecked }
  }

  const hostId = getRepoExecutionHostId(repo)
  const host = parseExecutionHostId(hostId)
  const matchingRepos = state.repos.filter((entry) => entry.id === repo.id)
  const candidates = getAllWorktreesFromState(state).filter(
    (worktree) =>
      worktree.repoId === repo.id &&
      !worktree.isMainWorktree &&
      !worktree.isBare &&
      parseWorkspaceKey(worktree.id)?.type !== 'folder' &&
      (worktree.hostId ? worktree.hostId === hostId : matchingRepos.length === 1)
  )
  const uniqueCandidates = new Map(
    candidates.map((target) => [getWorktreeHostIdentity(target), target])
  )
  const results = await mapSettledWithConcurrency(
    [...uniqueCandidates.values()],
    4,
    async (worktree) => {
      const status = await getRuntimeGitStatus(
        {
          settings: {
            activeRuntimeEnvironmentId: host?.kind === 'runtime' ? host.environmentId : null
          },
          worktreeId: worktree.id,
          worktreePath: worktree.path,
          connectionId: getRepoSshConnectionId(repo) ?? undefined
        },
        { admissionTier: 'interactive', includeLineStats: false }
      )
      if (
        !status.didHitLimit &&
        status.entries.length === 0 &&
        status.conflictOperation === 'unknown'
      ) {
        return worktree
      }
      return null
    }
  )
  for (const result of results) {
    if (result.status === 'rejected') {
      unchecked += 1
    } else if (result.value) {
      clean.push(result.value)
    }
  }
  return { clean, unchecked }
}

const pendingCleanups = new Map<string, Promise<void>>()

export function cleanProjectWorktrees(repo: Repo): Promise<void> {
  const identity = getRepoHostIdentity(repo)
  const pending = pendingCleanups.get(identity)
  if (pending) {
    return pending
  }

  const run = checkProjectWorktrees(repo).finally(() => pendingCleanups.delete(identity))
  pendingCleanups.set(identity, run)
  return run
}

async function checkProjectWorktrees(repo: Repo): Promise<void> {
  const toastId = toast.loading(translate('worktreeCleanup.checking', 'Checking worktrees…'))
  try {
    const state = useAppStore.getState()
    const currentRepo = state.repos.find(
      (entry) => getRepoHostIdentity(entry) === getRepoHostIdentity(repo)
    )
    if (!currentRepo || !isGitRepoKind(currentRepo)) {
      return
    }
    const { clean, unchecked } = await findCleanProjectWorktrees(currentRepo, state)
    if (unchecked > 0) {
      toast.warning(
        translate(
          'worktreeCleanup.unchecked',
          'Could not check {{count}} worktrees. They will be kept.',
          { count: unchecked }
        )
      )
    }
    if (clean.length === 0) {
      toast.info(translate('worktreeCleanup.none', 'No clean worktrees to remove'))
      return
    }
    // The host checks again at removal time; changes made after this scan must never be forced away.
    runWorktreeBatchDelete(toWorktreeDeleteIdentities(clean), {
      forceConfirm: true,
      forceOnConfirm: false
    })
  } catch (error) {
    toast.error(translate('worktreeCleanup.failed', 'Could not check worktrees'), {
      description: error instanceof Error ? error.message : String(error)
    })
  } finally {
    toast.dismiss(toastId)
  }
}
