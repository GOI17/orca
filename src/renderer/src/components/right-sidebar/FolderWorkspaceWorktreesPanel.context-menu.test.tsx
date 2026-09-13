// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SshConnectionState } from '../../../../shared/ssh-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../shared/workspace-scope'
import {
  makeFolderWorkspace,
  makeWorkspaceLineage,
  makeWorktree
} from '@/store/slices/worktrees-slice-test-fixtures'
import { TooltipProvider } from '@/components/ui/tooltip'
import FolderWorkspaceWorktreesPanel from './FolderWorkspaceWorktreesPanel'

const folder = makeFolderWorkspace()
const folderKey = folderWorkspaceKey(folder.id)
const worktrees = ['selected', 'sibling'].map((name) =>
  makeWorktree({
    id: `repo::${name}`,
    repoId: 'repo',
    displayName: name,
    instanceId: `${name}-instance`
  })
)
const repo: Repo = { id: 'repo', path: '/repo', displayName: 'Repo', badgeColor: '', addedAt: 0 }
const state = {
  activeWorkspaceKey: folderKey,
  activeWorktreeId: folderKey,
  activeWorkspaceExecutionHostId: 'local',
  folderWorkspaces: [folder],
  worktreesByRepo: { repo: worktrees },
  repos: [repo],
  workspaceLineageByChildKey: Object.fromEntries(
    worktrees.map((worktree) => {
      const key = worktreeWorkspaceKey(worktree.id)
      return [
        key,
        makeWorkspaceLineage({
          childWorkspaceKey: key,
          childInstanceId: worktree.instanceId,
          parentWorkspaceKey: folderKey
        })
      ]
    })
  ),
  worktreeLineageById: {},
  settings: {
    experimentalNewWorktreeCardStyle: true,
    skipDeleteWorktreeConfirm: false,
    activeRuntimeEnvironmentId: null,
    openInApplications: []
  },
  worktreeCardProperties: [],
  workspaceStatuses: [],
  projectGroups: [],
  keybindings: {},
  tabsByWorktree: {},
  browserTabsByWorktree: {},
  ptyIdsByTabId: {},
  deleteStateByWorktreeId: {},
  gitConflictOperationByWorktree: {},
  remoteBranchConflictByWorktreeId: {},
  hostedReviewCache: {},
  issueCache: {},
  linearIssueCache: {},
  renamingWorktreeId: null,
  removedSshTargetLabels: new Map(),
  sshConnectionStates: new Map([
    [
      'box',
      {
        status: 'connected',
        targetId: 'box',
        error: null,
        reconnectAttempt: 0
      } satisfies SshConnectionState
    ]
  ]),
  sshTargetLabels: new Map([['box', 'Test host']]),
  clearWorktreeDeleteState: vi.fn(),
  openModal: vi.fn(),
  deleteFolderWorkspace: vi.fn(),
  removeWorktree: vi.fn(),
  setActiveWorktree: vi.fn(),
  updateWorktreeMeta: vi.fn(),
  setWorktreesPinnedAndReveal: vi.fn(),
  createProjectGroup: vi.fn(),
  moveProjectToGroup: vi.fn(),
  updateWorktreeLineage: vi.fn()
}
vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
}))
vi.mock('@/store/selectors', () => ({
  useAllWorktrees: () => worktrees,
  useRepoById: () => repo,
  useRepoMap: () => new Map([[repo.id, repo]]),
  useWorktreeMap: () => new Map(worktrees.map((worktree) => [worktree.id, worktree])),
  getAllWorktreesFromState: () => worktrees,
  getWorktreeOnHostFromState: (_state: unknown, id: string, hostId?: ExecutionHostId) =>
    worktrees.find((worktree) => worktree.id === id && (!hostId || worktree.hostId === hostId))
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback,
  i18n: { language: 'en', on: () => {}, off: () => {} }
}))
vi.mock('@/components/sidebar/use-worktree-activity-status', () => ({
  useWorktreeActivityStatus: () => 'idle'
}))
vi.mock('@/components/sidebar/CacheTimer', () => ({
  default: () => null,
  usePromptCacheCountdownStartedAt: () => null
}))
vi.mock('@/components/sidebar/ProjectGroupNameDialog', () => ({
  ProjectGroupNameDialog: () => null
}))
vi.mock('@/components/sidebar/WorktreeParentPickerPopover', () => ({
  WorktreeParentPickerPopover: () => null
}))

function openAttachedMenu(worktree: Worktree): void {
  fireEvent.contextMenu(screen.getByText(worktree.displayName), { button: 2 })
}
function clickMenuItem(name: RegExp): void {
  const item = screen.getByRole('menuitem', { name })
  fireEvent.pointerDown(item, { button: 0 })
  fireEvent.click(item)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('attached worktree context menu', () => {
  it.each([
    ['Mac', 'local'],
    ['Linux', 'local'],
    ['Windows', 'local'],
    ['Mac', 'ssh:box'],
    ['Linux', 'ssh:box'],
    ['Windows', 'ssh:box']
  ] as const)('targets only the attached worktree on %s / %s', async (platform, hostId) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(platform)
    for (const worktree of worktrees) {
      worktree.hostId = hostId
    }
    repo.executionHostId = hostId
    repo.connectionId = hostId === 'local' ? undefined : 'box'
    render(
      <TooltipProvider>
        <FolderWorkspaceWorktreesPanel />
      </TooltipProvider>
    )

    openAttachedMenu(worktrees[0])
    expect(screen.getByText('Worktree')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^Remove Workspace/ })).toBeNull()
    clickMenuItem(/^Update$/)
    expect(state.openModal).toHaveBeenCalledWith(
      'edit-meta',
      expect.objectContaining({
        worktreeId: worktrees[0].id,
        executionHostId: hostId
      })
    )
    state.openModal.mockClear()

    openAttachedMenu(worktrees[0])
    clickMenuItem(/^Delete Worktree/)
    await waitFor(() =>
      expect(state.openModal).toHaveBeenCalledWith('delete-worktree', {
        worktreeId: worktrees[0].id,
        worktreeDeleteIdentities: [
          { id: worktrees[0].id, instanceId: worktrees[0].instanceId, hostId }
        ]
      })
    )
    expect(state.openModal).toHaveBeenCalledOnce()
    expect(state.activeWorktreeId).toBe(folderKey)
    expect(state.deleteFolderWorkspace).not.toHaveBeenCalled()
    expect(state.removeWorktree).not.toHaveBeenCalled()
    expect(state.setActiveWorktree).not.toHaveBeenCalled()
  })
})
