import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { AppState } from '@/store/types'
import { getRuntimeGitStatus } from '@/runtime/runtime-git-client'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { GitStatusResult } from '../../../../shared/git-status-types'
import { makeRepo, makeWorktree } from './worktree-list-lineage-card-test-fixtures'
import { runWorktreeBatchDelete } from './delete-worktree-flow'
import { cleanProjectWorktrees, findCleanProjectWorktrees } from './clean-project-worktrees'

const mocks = vi.hoisted(() => ({ getState: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: mocks.getState } }))
vi.mock('@/runtime/runtime-git-client', () => ({ getRuntimeGitStatus: vi.fn() }))
vi.mock('./delete-worktree-flow', () => ({ runWorktreeBatchDelete: vi.fn() }))
vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'checking'),
    dismiss: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}))

const cleanStatus: GitStatusResult = { entries: [], conflictOperation: 'unknown' }
function worktree(id: string, overrides: Partial<Worktree> = {}): Worktree {
  return {
    ...makeWorktree({
      id,
      instanceId: `${id}-instance`,
      displayName: id,
      branch: id,
      sortOrder: 0
    }),
    hostId: 'local',
    ...overrides
  }
}
function stateFor(
  rows: Worktree[],
  repos: Repo[] = [makeRepo()]
): Pick<AppState, 'repos' | 'worktreesByRepo'> {
  const state = { repos, worktreesByRepo: { rows } }
  mocks.getState.mockReturnValue(state)
  return state
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getRuntimeGitStatus).mockReset().mockResolvedValue(cleanStatus)
  stateFor([])
})

describe('clean project worktrees', () => {
  it('only checks child Git worktrees belonging to this project', async () => {
    const clean = worktree('clean')
    const state = stateFor([
      clean,
      clean,
      worktree('main', { isMainWorktree: true }),
      worktree('bare', { isBare: true }),
      worktree('folder:workspace'),
      worktree('other', { repoId: 'another-project' })
    ])
    expect(await findCleanProjectWorktrees(makeRepo(), state)).toEqual({
      clean: [clean],
      unchecked: 0
    })
    expect(getRuntimeGitStatus).toHaveBeenCalledTimes(1)
  })

  it.each(['staged', 'unstaged', 'untracked'] as const)('keeps %s changes', async (area) => {
    vi.mocked(getRuntimeGitStatus).mockResolvedValue({
      ...cleanStatus,
      entries: [{ path: 'file.txt', status: area === 'untracked' ? 'untracked' : 'modified', area }]
    })
    const result = await findCleanProjectWorktrees(makeRepo(), stateFor([worktree('dirty')]))
    expect(result.clean).toEqual([])
  })

  it('keeps incomplete results, active Git operations, and unreachable worktrees', async () => {
    vi.mocked(getRuntimeGitStatus)
      .mockResolvedValueOnce({ ...cleanStatus, didHitLimit: true })
      .mockResolvedValueOnce({ ...cleanStatus, conflictOperation: 'rebase' })
      .mockRejectedValueOnce(new Error('SSH disconnected'))
    const result = await findCleanProjectWorktrees(
      makeRepo(),
      stateFor(['limited', 'rebasing', 'unreachable'].map((id) => worktree(id)))
    )
    expect(result).toEqual({ clean: [], unchecked: 1 })
  })

  it.each([
    { executionHostId: 'local', environment: null, connection: undefined },
    { executionHostId: 'ssh:server', environment: null, connection: 'server' },
    { executionHostId: 'runtime:vm', environment: 'vm', connection: undefined }
  ] as const)(
    'isolates the $executionHostId owner despite identical ids and paths',
    async (target) => {
      const repos: Repo[] = (['local', 'ssh:server', 'runtime:vm'] as const).map(
        (executionHostId) => ({
          ...makeRepo(),
          executionHostId
        })
      )
      const repo: Repo = { ...makeRepo(), executionHostId: target.executionHostId }
      const selected = worktree('same', { hostId: target.executionHostId })
      const state = stateFor(
        [
          worktree('same', { hostId: 'local' }),
          worktree('same', { hostId: 'ssh:server' }),
          worktree('same', { hostId: 'runtime:vm' }),
          worktree('ambiguous', { hostId: undefined })
        ],
        repos
      )
      expect((await findCleanProjectWorktrees(repo, state)).clean).toEqual([selected])
      expect(getRuntimeGitStatus).toHaveBeenCalledExactlyOnceWith(
        {
          settings: { activeRuntimeEnvironmentId: target.environment },
          worktreeId: selected.id,
          worktreePath: selected.path,
          connectionId: target.connection
        },
        { admissionTier: 'interactive', includeLineStats: false }
      )
    }
  )

  it('supports legacy SSH projects and unambiguous hostless worktrees', async () => {
    const repo = { ...makeRepo(), connectionId: 'legacy-server' }
    const row = worktree('legacy', { hostId: undefined })
    expect((await findCleanProjectWorktrees(repo, stateFor([row], [repo]))).clean).toEqual([row])
    expect(getRuntimeGitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: 'legacy-server',
        settings: { activeRuntimeEnvironmentId: null }
      }),
      expect.anything()
    )
  })

  it('never scans folder projects', async () => {
    const repo: Repo = { ...makeRepo(), kind: 'folder' }
    const state = stateFor([worktree('child')], [repo])
    await cleanProjectWorktrees(repo)
    expect((await findCleanProjectWorktrees(repo, state)).clean).toEqual([])
    expect(getRuntimeGitStatus).not.toHaveBeenCalled()
    expect(runWorktreeBatchDelete).not.toHaveBeenCalled()
  })

  it('opens confirmation for clean identities without forcing removal', async () => {
    const row = worktree('clean', { hostId: 'ssh:server' })
    const repo: Repo = { ...makeRepo(), executionHostId: 'ssh:server' }
    stateFor([row, worktree('offline', { hostId: 'ssh:server' })], [repo])
    vi.mocked(getRuntimeGitStatus)
      .mockResolvedValueOnce(cleanStatus)
      .mockRejectedValueOnce(new Error('offline'))
    await cleanProjectWorktrees(repo)
    expect(runWorktreeBatchDelete).toHaveBeenCalledExactlyOnceWith(
      [{ id: row.id, instanceId: row.instanceId, hostId: row.hostId }],
      { forceConfirm: true, forceOnConfirm: false }
    )
    expect(toast.warning).toHaveBeenCalled()
    expect(toast.dismiss).toHaveBeenCalledWith('checking')
  })

  it('does not open deletion when every status check fails', async () => {
    stateFor([worktree('offline')])
    vi.mocked(getRuntimeGitStatus).mockRejectedValue(new Error('offline'))
    await cleanProjectWorktrees(makeRepo())
    expect(runWorktreeBatchDelete).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalled()
  })

  it('coalesces repeated requests and bounds concurrent status checks', async () => {
    stateFor(Array.from({ length: 10 }, (_, index) => worktree(String(index))))
    const releases: (() => void)[] = []
    vi.mocked(getRuntimeGitStatus).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(() => resolve(cleanStatus))
        })
    )
    const first = cleanProjectWorktrees(makeRepo())
    expect(cleanProjectWorktrees(makeRepo())).toBe(first)
    expect(getRuntimeGitStatus).toHaveBeenCalledTimes(4)
    for (let start = 0; start < 10; start += 4) {
      for (const release of releases.splice(0)) {
        release()
      }
      await vi.waitFor(() =>
        expect(getRuntimeGitStatus).toHaveBeenCalledTimes(Math.min(start + 8, 10))
      )
    }
    await first
    expect(runWorktreeBatchDelete).toHaveBeenCalledTimes(1)
  })
})
