import { describe, expect, it, vi } from 'vitest'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import {
  parseOpenCode2SessionCommand,
  readOpenCode2SessionCommands
} from './opencode2-session-commands'

describe('OpenCode 2 session commands', () => {
  it('publishes provider commands for the chat slash palette', async () => {
    const get = vi.fn(async () => [
      { name: 'init', description: 'Create instructions' },
      { name: 'review' }
    ])

    await expect(
      readOpenCode2SessionCommands({ get } as unknown as OpenCode2HttpClient)
    ).resolves.toEqual([
      { name: 'init', kind: 'command', description: 'Create instructions' },
      { name: 'review', kind: 'command' }
    ])
  })

  it('recognizes only exact provider command names and separates arguments', () => {
    const commands = [{ name: 'review', kind: 'command' as const }]
    expect(parseOpenCode2SessionCommand('/review branch', commands)).toEqual({
      command: 'review',
      text: 'branch'
    })
    expect(parseOpenCode2SessionCommand('/reviews branch', commands)).toBeNull()
    expect(parseOpenCode2SessionCommand(' /review branch', commands)).toBeNull()
  })
})
