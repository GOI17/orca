import { describe, expect, it } from 'vitest'
import {
  PERSONAL_CHATS_RUNTIME_CAPABILITY,
  STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY
} from '../../../../shared/protocol-version'
import type { RuntimeMobileSessionTabsResult } from '../../../../shared/runtime-types'
import { projectSessionTabAgentStatus } from './session-tab-agent-status-projection'

const snapshot: RuntimeMobileSessionTabsResult = {
  worktree: 'personal-chats',
  publicationEpoch: 'structured:1',
  snapshotVersion: 1,
  activeTabId: 'agent-session:codex_1',
  activeTabType: 'agent-session',
  activeGroupId: 'group',
  tabGroups: [
    { id: 'group', tabOrder: ['agent-session:codex_1'], activeTabId: 'agent-session:codex_1' }
  ],
  tabs: [
    {
      type: 'agent-session',
      id: 'agent-session:codex_1',
      sessionId: 'codex_1',
      title: 'Personal chat',
      agent: 'codex',
      isActive: true
    }
  ]
}

describe('personal chat wire compatibility', () => {
  it.each(['runtime', 'mobile'] as const)(
    'hides personal sessions from an older %s client',
    (clientKind) => {
      const projected = projectSessionTabAgentStatus(
        snapshot,
        clientKind,
        [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
        true
      )
      expect(projected.tabs).toEqual([])
      expect(projected.activeTabId).toBeNull()
      expect(projected.tabGroups?.every((group) => group.tabOrder.length === 0)).toBe(true)
    }
  )

  it('publishes to the desktop personal-chat surface', () => {
    expect(
      projectSessionTabAgentStatus(
        snapshot,
        'runtime',
        [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY, PERSONAL_CHATS_RUNTIME_CAPABILITY],
        true
      )
    ).toBe(snapshot)
  })
})
