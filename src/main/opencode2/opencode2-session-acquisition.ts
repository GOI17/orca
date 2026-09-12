import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import type { AgentSessionProviderHandleLink } from '../../shared/agent-session-provider-handle'
import type { StructuredAgentSessionAcquireInput } from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import type { OpenCode2ServerConnection } from './opencode2-server-connection'

export async function openOpenCode2ProviderSession(
  connection: OpenCode2ServerConnection,
  identity: AgentSessionJournalIdentity,
  cwd: string
): Promise<{ providerSessionId: string; resumed: boolean }> {
  const existing =
    identity.providerHandle.kind === 'opaque' && identity.providerHandle.agent === 'opencode2'
      ? identity.providerHandle.value
      : null
  if (existing && existing !== 'pending') {
    const session = await connection.client.get<{ id: string }>(
      `/api/session/${encodeURIComponent(existing)}`
    )
    return { providerSessionId: session.id, resumed: true }
  }
  const session = await connection.client.post<{ id: string }>('/api/session', {
    location: { directory: cwd }
  })
  return { providerSessionId: session.id, resumed: false }
}

export function openCode2ProviderHandleLink(
  providerSessionId: string,
  input: StructuredAgentSessionAcquireInput,
  resumed: boolean,
  observedAt: number
): AgentSessionProviderHandleLink {
  return {
    linkId: `opencode2-${input.fence}-${providerSessionId}`.slice(0, 128),
    handle: { provider: 'opencode2', sessionId: providerSessionId },
    origin: resumed ? 'resumed' : 'created',
    mintedAtFence: input.fence,
    observedAt
  }
}
