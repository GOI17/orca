import { describe, expect, it } from 'vitest'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import { openOpenCode2ServerConnection } from './opencode2-server-connection'
import { OpenCode2StructuredSessionAdapter } from './opencode2-structured-session-adapter'

describe.runIf(process.env.ORCA_TEST_OPENCODE2 === '1')('OpenCode 2 real server', () => {
  it('starts an authenticated private server and proves shutdown', async () => {
    const connection = await openOpenCode2ServerConnection({
      command: 'opencode2',
      cwd: process.cwd()
    })
    try {
      await expect(
        connection.client.get<{ healthy: boolean }>('/api/health')
      ).resolves.toMatchObject({ healthy: true })
    } finally {
      await expect(connection.close()).resolves.toBe(true)
    }
  }, 30_000)

  it('acquires a real structured session and proves shutdown', async () => {
    const sink: StructuredAgentSessionEventSink = {
      appendItem: () => {},
      appendTombstone: () => {},
      publish: () => {}
    }
    const adapter = new OpenCode2StructuredSessionAdapter({
      resolveLaunch: async () => ({ command: 'opencode2', cwd: process.cwd() }),
      pollIntervalMs: 60_000
    })
    try {
      const acquired = await adapter.acquire({
        identity: {
          sessionId: 'opencode2_real_binary_test',
          workspaceId: 'workspace-test',
          hostId: 'local',
          agent: 'opencode2',
          providerHandle: { kind: 'opaque', agent: 'opencode2', value: 'pending' }
        },
        fence: 1,
        spawnToken: 'real-binary-test-token',
        events: sink
      })
      expect(acquired.link.handle).toMatchObject({ provider: 'opencode2' })
      expect(acquired.process.processStartTimeMs).not.toBeNull()
      const options = await adapter.readOptions?.({
        sessionId: 'opencode2_real_binary_test',
        fence: 1
      })
      expect(options?.models.length).toBeGreaterThan(0)
      expect(options?.current.model).toBeTruthy()
      await expect(
        adapter.setOption({
          sessionId: 'opencode2_real_binary_test',
          fence: 1,
          key: 'model',
          value: options!.current.model
        })
      ).resolves.toMatchObject({ model: options!.current.model })
      expect(adapter.readCommands?.('opencode2_real_binary_test')).toBeDefined()
    } finally {
      await expect(adapter.closeAll()).resolves.toBeUndefined()
    }
  }, 30_000)
})
