import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { getProfileUserDataPath } from './orca-profiles/profile-storage-paths'
import { PERSONAL_CHATS_WORKSPACE_ID } from '../shared/personal-chats'
import { mergeWorktree } from './ipc/worktree-logic'
import type { ResolvedWorktree } from './runtime/runtime-worktree-path-identity'

export async function ensurePersonalChatDirectory(): Promise<string> {
  const directory = join(getProfileUserDataPath(), 'personal-chats')
  await mkdir(directory, { recursive: true })
  return directory
}

export async function resolvePersonalChatFileTarget(): Promise<ResolvedWorktree> {
  const git = {
    path: await ensurePersonalChatDirectory(),
    head: '',
    branch: '',
    isBare: false,
    isMainWorktree: false
  }
  return {
    ...mergeWorktree(PERSONAL_CHATS_WORKSPACE_ID, git, undefined, 'Personal chats'),
    id: PERSONAL_CHATS_WORKSPACE_ID,
    hostId: 'local',
    parentWorktreeId: null,
    childWorktreeIds: [],
    lineage: null,
    git
  }
}
