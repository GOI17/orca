import { describe, expect, it } from 'vitest'
import { openOpenCode2ServerConnection } from './opencode2-server-connection'

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
})
