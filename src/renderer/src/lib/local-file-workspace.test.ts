import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openLocalFileInWorkspace } from './local-file-workspace'

const mocks = vi.hoisted(() => ({
  route: vi.fn(),
  activate: vi.fn(),
  store: {
    settings: { activeRuntimeEnvironmentId: 'remote-host' },
    createProjectGroup: vi.fn(),
    createFolderWorkspace: vi.fn(),
    openFile: vi.fn()
  }
}))
vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.store } }))
vi.mock('./runtime-workspace-file-route', () => ({ findWorkspaceFileRoute: mocks.route }))
vi.mock('./worktree-activation', () => ({ activateAndRevealWorkspace: mocks.activate }))

describe('native local file routing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.store.openFile.mockReturnValue('editor-1')
    mocks.activate.mockReturnValue({ primaryTabId: null })
    mocks.store.createProjectGroup.mockResolvedValue({ id: 'group-1' })
    mocks.store.createFolderWorkspace.mockResolvedValue({ id: 'folder-1' })
  })

  it('reuses an existing local workspace while a remote runtime is selected', async () => {
    mocks.route.mockReturnValue({ worktreeId: 'repo::/notes', relativePath: 'README.md' })
    await expect(openLocalFileInWorkspace('/notes/README.md')).resolves.toBe('editor-1')
    expect(mocks.route).toHaveBeenCalledWith(mocks.store, 'local', '/notes/README.md')
    expect(mocks.store.createProjectGroup).not.toHaveBeenCalled()
    expect(mocks.activate).toHaveBeenCalledWith('repo::/notes', {
      executionHostId: 'local',
      providesInitialSurface: true
    })
    expect(mocks.store.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'repo::/notes', runtimeEnvironmentId: null }),
      { preview: false, suppressActiveRuntimeFallback: true }
    )
  })

  it.each([
    ['/notes/README.md', '/notes', 'notes'],
    ['C:\\notes\\README.md', 'C:/notes', 'notes'],
    ['C:\\README.md', 'C:/', 'C:'],
    ['/README.md', '/', '/']
  ])(
    'creates an explicitly local folder workspace for an unowned file: %s',
    async (filePath, folderPath, name) => {
      mocks.route.mockReturnValue(null)
      await openLocalFileInWorkspace(filePath)
      expect(mocks.store.createProjectGroup).toHaveBeenCalledWith(name, {
        activeRuntimeEnvironmentId: null
      })
      expect(mocks.store.createFolderWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ projectGroupId: 'group-1', folderPath, connectionId: null }),
        { runtimeEnvironmentId: null }
      )
      expect(mocks.store.openFile).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath,
          worktreeId: 'folder:folder-1',
          runtimeEnvironmentId: null
        }),
        expect.objectContaining({ suppressActiveRuntimeFallback: true })
      )
    }
  )

  it('reports creation failure without opening a hidden editor tab', async () => {
    mocks.route.mockReturnValue(null)
    mocks.store.createProjectGroup.mockResolvedValue(null)
    await expect(openLocalFileInWorkspace('/notes/README.md')).rejects.toThrow('local project')
    expect(mocks.store.openFile).not.toHaveBeenCalled()
  })
  it('reports activation failure without opening a hidden editor tab', async () => {
    mocks.route.mockReturnValue({ worktreeId: 'repo::/notes', relativePath: 'README.md' })
    mocks.activate.mockReturnValue(false)
    await expect(openLocalFileInWorkspace('/notes/README.md')).rejects.toThrow('activate')
    expect(mocks.store.openFile).not.toHaveBeenCalled()
  })
})
