// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { TooltipProvider } from '@/components/ui/tooltip'
import WorktreeContextMenu from './WorktreeContextMenu'

const repos: Repo[] = [
  { id: 'repo', path: '/repo', displayName: 'Repo', badgeColor: '', addedAt: 0 }
]
const state = {
  repos,
  activeWorktreeId: 'folder:parent',
  activeWorkspaceExecutionHostId: 'local',
  updateWorktreeMeta: vi.fn(),
  setWorktreesPinnedAndReveal: vi.fn(),
  workspaceStatuses: [],
  openModal: vi.fn(),
  projectGroups: [],
  createProjectGroup: vi.fn(),
  moveProjectToGroup: vi.fn(),
  deleteFolderWorkspace: vi.fn(async () => true),
  setActiveWorktree: vi.fn(),
  deleteStateByWorktreeId: {},
  worktreeLineageById: {},
  workspaceLineageByChildKey: {},
  updateWorktreeLineage: vi.fn(),
  tabsByWorktree: {},
  ptyIdsByTabId: {},
  browserTabsByWorktree: {},
  keybindings: {},
  settings: { activeRuntimeEnvironmentId: null, openInApplications: [] }
}
const deletion = vi.hoisted(() => ({ single: vi.fn(), batch: vi.fn() }))
vi.mock('@/store', () => ({
  useAppStore: Object.assign((selector: (s: typeof state) => unknown) => selector(state), {
    getState: () => state
  })
}))
vi.mock('@/store/selectors', () => ({
  useAllWorktrees: () => [],
  useRepoById: (id: string) => state.repos.find((repo) => repo.id === id),
  useRepoMap: () => new Map(state.repos.map((repo) => [repo.id, repo])),
  useWorktreeMap: () => new Map()
}))
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback,
  i18n: { language: 'en', on: () => {}, off: () => {} }
}))
vi.mock('./ProjectGroupNameDialog', () => ({ ProjectGroupNameDialog: () => null }))
vi.mock('./WorktreeParentPickerPopover', () => ({ WorktreeParentPickerPopover: () => null }))
vi.mock('./delete-worktree-flow', () => ({
  runWorktreeDelete: deletion.single,
  runWorktreeBatchDelete: deletion.batch
}))

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo::child',
    repoId: 'repo',
    path: '/repo/child',
    displayName: 'Child',
    hostId: 'ssh:box',
    instanceId: 'child-instance',
    head: 'abc',
    branch: 'child',
    isBare: false,
    isMainWorktree: false,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}
const child = makeWorktree()
const folder = makeWorktree({
  id: 'folder:parent',
  repoId: 'folder-workspace:group',
  path: '/parent',
  displayName: 'Parent',
  hostId: 'local'
})

function menu(worktree: Worktree) {
  return (
    <TooltipProvider>
      <WorktreeContextMenu worktree={worktree}>
        <span data-testid="target">Target</span>
      </WorktreeContextMenu>
    </TooltipProvider>
  )
}

function clickMenuItem(item: HTMLElement): void {
  fireEvent.pointerDown(item, { button: 0 })
  fireEvent.click(item)
}

afterEach(() => {
  cleanup()
  delete repos[0].kind
  vi.clearAllMocks()
})

describe('context menu action target', () => {
  it('labels a Git worktree explicitly', () => {
    render(menu(child))
    fireEvent.contextMenu(screen.getByTestId('target'))
    expect(screen.getByText('Worktree')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^Delete Worktree/ })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^Remove Workspace/ })).toBeNull()
  })

  it('keeps the clicked identity if a row is reused while its menu is open', async () => {
    const view = render(menu(child))
    fireEvent.contextMenu(screen.getByTestId('target'))
    view.rerender(menu(folder))
    clickMenuItem(screen.getByRole('menuitem', { name: /^Delete/ }))
    await waitFor(() =>
      expect(deletion.single).toHaveBeenCalledWith(child.id, {
        expectedInstanceId: child.instanceId,
        expectedHostId: child.hostId
      })
    )
    expect(state.deleteFolderWorkspace).not.toHaveBeenCalled()
    expect(deletion.batch).not.toHaveBeenCalled()
  })

  it('keeps Update on the clicked identity after a row changes', () => {
    const view = render(menu(child))
    fireEvent.contextMenu(screen.getByTestId('target'))
    view.rerender(menu(folder))
    clickMenuItem(screen.getByRole('menuitem', { name: 'Update' }))
    expect(state.openModal).toHaveBeenCalledWith(
      'edit-meta',
      expect.objectContaining({
        worktreeId: child.id,
        executionHostId: child.hostId,
        repoId: child.repoId
      })
    )
  })

  it('opens only the nested worktree menu and deletes only that child', async () => {
    const parentOpen = vi.fn()
    render(
      <TooltipProvider>
        <WorktreeContextMenu worktree={folder} onOpenChange={parentOpen}>
          <span>Folder</span>
          <WorktreeContextMenu worktree={child}>
            <span data-testid="child">Child</span>
          </WorktreeContextMenu>
        </WorktreeContextMenu>
      </TooltipProvider>
    )
    fireEvent.contextMenu(screen.getByTestId('child'))
    expect(parentOpen).not.toHaveBeenCalledWith(true)
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    clickMenuItem(screen.getByRole('menuitem', { name: /^Delete/ }))
    await waitFor(() =>
      expect(deletion.single).toHaveBeenCalledWith(child.id, {
        expectedInstanceId: child.instanceId,
        expectedHostId: child.hostId
      })
    )
    expect(state.deleteFolderWorkspace).not.toHaveBeenCalled()
  })

  it('ignores an unrelated selection when right-clicking a worktree', async () => {
    render(
      <TooltipProvider>
        <WorktreeContextMenu
          worktree={child}
          selectedWorktrees={[folder, makeWorktree({ id: 'repo::other' })]}
        >
          <span data-testid="target">Target</span>
        </WorktreeContextMenu>
      </TooltipProvider>
    )
    fireEvent.contextMenu(screen.getByTestId('target'))
    clickMenuItem(screen.getByRole('menuitem', { name: /^Delete Worktree/ }))
    await waitFor(() =>
      expect(deletion.single).toHaveBeenCalledWith(child.id, {
        expectedInstanceId: child.instanceId,
        expectedHostId: child.hostId
      })
    )
    expect(deletion.batch).not.toHaveBeenCalled()
    expect(state.deleteFolderWorkspace).not.toHaveBeenCalled()
  })

  it('keeps an intentional batch selection and names the worktrees', async () => {
    const other = makeWorktree({ id: 'repo::other', instanceId: 'other-instance' })
    render(
      <TooltipProvider>
        <WorktreeContextMenu worktree={child} selectedWorktrees={[child, other]}>
          <span data-testid="target">Target</span>
        </WorktreeContextMenu>
      </TooltipProvider>
    )
    fireEvent.contextMenu(screen.getByTestId('target'))
    clickMenuItem(screen.getByRole('menuitem', { name: 'Delete 2 Worktrees' }))
    await waitFor(() =>
      expect(deletion.batch).toHaveBeenCalledWith(
        [child, other].map(({ id, instanceId, hostId }) => ({ id, instanceId, hostId }))
      )
    )
    expect(deletion.single).not.toHaveBeenCalled()
    expect(state.deleteFolderWorkspace).not.toHaveBeenCalled()
  })

  it('captures the new row on the next right-click', async () => {
    const view = render(menu(child))
    fireEvent.contextMenu(screen.getByTestId('target'))
    view.rerender(menu(folder))
    fireEvent.contextMenu(screen.getByTestId('target'))
    clickMenuItem(screen.getByRole('menuitem', { name: /^Remove Workspace/ }))
    await waitFor(() =>
      expect(state.deleteFolderWorkspace).toHaveBeenCalledWith('parent', {
        executionHostId: 'local'
      })
    )
    expect(deletion.single).not.toHaveBeenCalled()
  })

  it('retains workspace labels for a legacy folder project', () => {
    repos[0].kind = 'folder'
    render(menu(child))
    fireEvent.contextMenu(screen.getByTestId('target'))
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /^Delete / })).toBeTruthy()
    expect(screen.queryByText('Delete Worktree')).toBeNull()
  })

  it('does not let an ancestor workspace menu handle the same right-click', () => {
    const workspaceContextMenu = vi.fn()
    render(<div onContextMenu={workspaceContextMenu}>{menu(child)}</div>)
    fireEvent.contextMenu(screen.getByTestId('target'))
    expect(screen.getByText('Worktree')).toBeTruthy()
    expect(workspaceContextMenu).not.toHaveBeenCalled()
  })

  it('keeps primary checkout deletion disabled and project removal explicit', () => {
    render(menu(makeWorktree({ isMainWorktree: true })))
    fireEvent.contextMenu(screen.getByTestId('target'))
    expect(
      screen.getByRole('menuitem', { name: 'Delete Worktree' }).getAttribute('aria-disabled')
    ).toBe('true')
    expect(
      screen
        .getByRole('menuitem', { name: 'Remove Project from Orca' })
        .getAttribute('aria-disabled')
    ).not.toBe('true')
  })

  it('retains the folder workspace menu and its removal route', async () => {
    render(menu(folder))
    fireEvent.contextMenu(screen.getByTestId('target'))
    expect(screen.getByText('Workspace')).toBeTruthy()
    clickMenuItem(screen.getByRole('menuitem', { name: /^Remove Workspace/ }))
    await waitFor(() =>
      expect(state.deleteFolderWorkspace).toHaveBeenCalledWith('parent', {
        executionHostId: 'local'
      })
    )
    expect(deletion.single).not.toHaveBeenCalled()
    expect(deletion.batch).not.toHaveBeenCalled()
  })
})
