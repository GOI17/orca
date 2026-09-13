import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ensurePersonalChatDirectory,
  resolvePersonalChatFileTarget
} from './personal-chat-directory'
import { getProfileUserDataPath } from './orca-profiles/profile-storage-paths'
import { OrcaRuntimeService } from './runtime/orca-runtime'

vi.mock('./orca-profiles/profile-storage-paths', () => ({ getProfileUserDataPath: vi.fn() }))

class PersonalChatRuntime extends OrcaRuntimeService {
  resolvePersonalFiles(selector: string) {
    return this.resolveRuntimeFileTarget(selector)
  }
}

let directory: string | undefined
afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }
})

describe('personal chat execution directory', () => {
  it('creates a stable directory without registering or initializing a project', async () => {
    directory = await mkdtemp(join(tmpdir(), 'orca-personal-chat-'))
    vi.mocked(getProfileUserDataPath).mockReturnValue(directory)
    const first = await ensurePersonalChatDirectory()
    expect(await ensurePersonalChatDirectory()).toBe(first)
    expect(first).toBe(join(directory, 'personal-chats'))
    expect(await readdir(first)).toEqual([])
    expect(await resolvePersonalChatFileTarget()).toMatchObject({
      id: 'personal-chats',
      path: first,
      hostId: 'local',
      branch: ''
    })
  })

  it('resolves personal files with no repository store or active workspace', async () => {
    directory = await mkdtemp(join(tmpdir(), 'orca-personal-chat-'))
    vi.mocked(getProfileUserDataPath).mockReturnValue(directory)
    const runtime = new PersonalChatRuntime()
    for (const selector of ['personal-chats', 'id:personal-chats']) {
      expect(await runtime.resolvePersonalFiles(selector)).toMatchObject({
        executionHostId: 'local',
        worktree: { id: 'personal-chats', path: join(directory, 'personal-chats') }
      })
    }
  })
})
