import { describe, expect, it, vi } from 'vitest'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import {
  parseOpenCode2SessionAction,
  readOpenCode2SessionCommands
} from './opencode2-session-commands'

describe('OpenCode 2 session commands', () => {
  it('publishes provider commands for the chat slash palette', async () => {
    const get = vi.fn(async (path: string) =>
      path === '/api/command'
        ? [{ name: 'init', description: 'Create instructions' }, { name: 'review' }]
        : [{ id: 'report', name: 'Report', description: 'Report a bug', slash: true }]
    )

    await expect(
      readOpenCode2SessionCommands({ get } as unknown as OpenCode2HttpClient)
    ).resolves.toEqual({
      entries: [
        { name: 'init', kind: 'command', description: 'Create instructions' },
        { name: 'review', kind: 'command' },
        { name: 'report', kind: 'skill', description: 'Report a bug' }
      ],
      skillIds: new Map([['report', 'report']])
    })
  })

  it('recognizes only exact provider command names and separates arguments', () => {
    const catalog = {
      entries: [
        { name: 'review', kind: 'command' as const },
        { name: 'report', kind: 'skill' as const }
      ],
      skillIds: new Map([['report', 'report']])
    }
    expect(parseOpenCode2SessionAction('/review branch', catalog)).toEqual({
      kind: 'command',
      command: 'review',
      text: 'branch'
    })
    expect(parseOpenCode2SessionAction('/report crash details', catalog)).toEqual({
      kind: 'skill',
      skill: 'report',
      text: 'crash details'
    })
    expect(parseOpenCode2SessionAction('/reviews branch', catalog)).toBeNull()
    expect(parseOpenCode2SessionAction(' /review branch', catalog)).toBeNull()
  })
})
