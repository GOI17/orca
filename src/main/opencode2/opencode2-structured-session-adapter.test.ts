import { describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import type { OpenCode2ServerConnection } from './opencode2-server-connection'
import { OpenCode2StructuredSessionAdapter } from './opencode2-structured-session-adapter'

const IDENTITY: AgentSessionJournalIdentity = {
  sessionId: 'opencode2_orca_session',
  workspaceId: 'workspace-1',
  hostId: LOCAL_EXECUTION_HOST_ID,
  agent: 'opencode2',
  providerHandle: { kind: 'opaque', agent: 'opencode2', value: 'pending' }
}

function harness() {
  const requests: { method: string; path: string; body?: unknown }[] = []
  const client: OpenCode2HttpClient = {
    get: (async (path: string) => {
      requests.push({ method: 'GET', path })
      return []
    }) as OpenCode2HttpClient['get'],
    getEnvelope: (async () => ({
      data: [],
      cursor: { next: null }
    })) as OpenCode2HttpClient['getEnvelope'],
    post: (async (path: string, body?: unknown) => {
      requests.push({ method: 'POST', path, body })
      if (path === '/api/session') {
        return { id: 'ses_provider' }
      }
      if (path.endsWith('/interrupt')) {
        return { interrupted: true }
      }
      return undefined
    }) as OpenCode2HttpClient['post'],
    events: async function* () {}
  }
  let closed = false
  const connection: OpenCode2ServerConnection = {
    pid: 4242,
    client,
    get closed() {
      return closed
    },
    close: vi.fn(async () => {
      closed = true
      return true
    })
  }
  const sink: StructuredAgentSessionEventSink = {
    appendItem: () => {},
    appendTombstone: () => {},
    publish: () => {}
  }
  const adapter = new OpenCode2StructuredSessionAdapter({
    resolveLaunch: async () => ({ command: 'opencode2', cwd: '/workspace' }),
    openConnection: async () => connection,
    readProcessStartTime: async () => 1_700_000_000_000,
    pollIntervalMs: 60_000
  })
  return { adapter, connection, requests, sink }
}

describe('OpenCode2StructuredSessionAdapter', () => {
  it('creates a provider session and returns a durable OpenCode 2 handle', async () => {
    const { adapter, requests, sink } = harness()

    const acquired = await adapter.acquire({
      identity: IDENTITY,
      fence: 3,
      spawnToken: 'spawn-token',
      events: sink
    })

    expect(acquired.process).toEqual({
      hostId: LOCAL_EXECUTION_HOST_ID,
      pid: 4242,
      processStartTimeMs: 1_700_000_000_000,
      spawnToken: 'spawn-token'
    })
    expect(acquired.link).toMatchObject({
      handle: { provider: 'opencode2', sessionId: 'ses_provider' },
      origin: 'created',
      mintedAtFence: 3
    })
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/api/session',
      body: { location: { directory: '/workspace' } }
    })
    await adapter.closeAll()
  })

  it('sends and interrupts through the provider API', async () => {
    const { adapter, requests, sink } = harness()
    await adapter.acquire({ identity: IDENTITY, fence: 1, spawnToken: 'token', events: sink })

    const sent = await adapter.dispatch({
      sessionId: IDENTITY.sessionId,
      clientMessageId: 'client-message',
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'Fix it' }] },
      fence: 1
    })
    const cancelled = await adapter.cancelTurn({
      sessionId: IDENTITY.sessionId,
      turnId: 'turn-1',
      fence: 1
    })

    expect(sent).toMatchObject({ state: 'accepted' })
    expect(cancelled).toEqual({ cancelled: true })
    expect(requests).toContainEqual({
      method: 'POST',
      path: '/api/session/ses_provider/prompt',
      body: { text: 'Fix it', metadata: { orcaClientMessageId: 'client-message' } }
    })
    await adapter.closeAll()
  })

  it('supports local native workspaces only', () => {
    const { adapter } = harness()
    expect(
      adapter.supportsLocation?.({
        executionHostId: LOCAL_EXECUTION_HOST_ID,
        wslDistro: null,
        workspaceId: 'workspace-1',
        workspaceKind: 'folder'
      })
    ).toBe(true)
    expect(
      adapter.supportsLocation?.({
        executionHostId: 'ssh:host',
        wslDistro: null,
        workspaceId: 'workspace-1',
        workspaceKind: 'folder'
      })
    ).toBe(false)
  })
})
