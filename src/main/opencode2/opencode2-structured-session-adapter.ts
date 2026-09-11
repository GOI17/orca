import { randomUUID } from 'node:crypto'
import type {
  AgentJournalMessageItem,
  AgentSessionJournalIdentity
} from '../../shared/agent-session-journal-types'
import type { AgentSessionProviderHandleLink } from '../../shared/agent-session-provider-handle'
import type { AgentSessionExecutionLocation } from '../../shared/agent-session-record'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { readProcessStartTimeMs } from '../runtime/agent-session-process-identity-probe'
import type {
  AgentSessionAcquisition,
  AgentSessionDispatchOutcome,
  StructuredAgentSessionAcquireInput,
  StructuredAgentSessionAdapter,
  StructuredAgentSessionLifecycleEvent
} from '../native-chat/agent-session-wire/structured-agent-session-adapter'
import { OpenCode2JournalTranslator } from './opencode2-journal-translation'
import { OpenCode2SessionMonitor } from './opencode2-session-monitor'
import {
  openOpenCode2ServerConnection,
  type OpenCode2ServerConnection
} from './opencode2-server-connection'

export type OpenCode2StructuredLaunch = {
  command: string
  cwd: string
  env?: NodeJS.ProcessEnv
  autoApprove?: boolean
}

export type OpenCode2StructuredSessionAdapterDeps = {
  resolveLaunch(input: {
    identity: AgentSessionJournalIdentity
  }): Promise<OpenCode2StructuredLaunch>
  openConnection?: typeof openOpenCode2ServerConnection
  readProcessStartTime?: (pid: number) => Promise<number | null>
  onEvent?: (event: StructuredAgentSessionLifecycleEvent) => void
  now?: () => number
  pollIntervalMs?: number
}

type OpenCode2Session = {
  connection: OpenCode2ServerConnection
  providerSessionId: string
  translator: OpenCode2JournalTranslator
  fence: number
  acquisitionGeneration: string
  requestedClose: boolean
  monitor: OpenCode2SessionMonitor
}

const DEFAULT_POLL_INTERVAL_MS = 2_000
const SPAWN_TOKEN_ENV = 'ORCA_AGENT_SESSION_SPAWN_TOKEN'

export class OpenCode2StructuredSessionAdapter implements StructuredAgentSessionAdapter {
  private readonly sessions = new Map<string, OpenCode2Session>()

  constructor(private readonly deps: OpenCode2StructuredSessionAdapterDeps) {}

  supportsLocation = (location: AgentSessionExecutionLocation): boolean =>
    location.executionHostId === LOCAL_EXECUTION_HOST_ID && !location.wslDistro

  async acquire(input: StructuredAgentSessionAcquireInput): Promise<AgentSessionAcquisition> {
    await this.closeSession(input.identity.sessionId)
    const launch = await this.deps.resolveLaunch({ identity: input.identity })
    const acquisitionGeneration = randomUUID()
    let unexpected: Error | null = null
    const open = this.deps.openConnection ?? openOpenCode2ServerConnection
    const connection = await open(
      {
        ...launch,
        env: { ...process.env, ...launch.env, [SPAWN_TOKEN_ENV]: input.spawnToken }
      },
      (error) => {
        unexpected = error
        this.handleUnexpectedExit(input.identity.sessionId, acquisitionGeneration, error)
      }
    )
    try {
      const providerSessionId = await this.openProviderSession(
        connection,
        input.identity,
        launch.cwd
      )
      const translator = new OpenCode2JournalTranslator(
        connection.client,
        providerSessionId,
        input.events ?? this.noopSink(),
        launch.autoApprove === true
      )
      await translator.refresh()
      const processStartTimeMs = await this.readStartTime(connection.pid)
      if (unexpected || connection.closed) {
        throw unexpected ?? new Error('OpenCode 2 server exited during acquisition.')
      }
      const session: OpenCode2Session = {
        connection,
        providerSessionId,
        translator,
        fence: input.fence,
        acquisitionGeneration,
        requestedClose: false,
        monitor: new OpenCode2SessionMonitor(
          input.identity.sessionId,
          providerSessionId,
          connection.client,
          translator,
          this.deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
        )
      }
      this.sessions.set(input.identity.sessionId, session)
      session.monitor.start()
      return {
        process: {
          hostId: input.identity.hostId,
          pid: connection.pid as number,
          processStartTimeMs,
          spawnToken: input.spawnToken
        },
        link: this.providerHandleLink(
          providerSessionId,
          input,
          input.identity.providerHandle.kind === 'opaque' &&
            input.identity.providerHandle.agent === 'opencode2' &&
            input.identity.providerHandle.value !== 'pending'
        ),
        acquisitionGeneration
      }
    } catch (error) {
      await connection.close()
      throw error
    }
  }

  async dispatch(input: {
    sessionId: string
    clientMessageId: string
    body: AgentJournalMessageItem
    fence: number
  }): Promise<AgentSessionDispatchOutcome> {
    const session = this.session(input.sessionId)
    const text = input.body.blocks
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('\n')
    if (!text.trim()) {
      return { state: 'rejected', reason: 'OpenCode 2 requires a text prompt.' }
    }
    await session.connection.client.post(
      `/api/session/${encodeURIComponent(session.providerSessionId)}/prompt`,
      { text, metadata: { orcaClientMessageId: input.clientMessageId } }
    )
    await session.monitor.refresh()
    return {
      state: 'accepted',
      providerIdentity: {
        provider: 'legacy',
        agent: 'opencode2',
        sessionId: session.providerSessionId,
        recordId: input.clientMessageId
      }
    }
  }

  async cancelTurn(input: {
    sessionId: string
    turnId: string
    fence: number
  }): Promise<{ cancelled: boolean }> {
    const session = this.session(input.sessionId)
    const result = await session.connection.client.post<{ interrupted?: boolean }>(
      `/api/session/${encodeURIComponent(session.providerSessionId)}/interrupt`,
      {}
    )
    return { cancelled: result?.interrupted !== false }
  }

  compact = async (input: { sessionId: string }): Promise<{ error?: string }> => {
    const session = this.session(input.sessionId)
    await session.connection.client.post(
      `/api/session/${encodeURIComponent(session.providerSessionId)}/compact`,
      {}
    )
    return {}
  }

  answerPrompt = async (input: {
    sessionId: string
    itemId: string
    optionId: string
  }): Promise<void> => {
    await this.session(input.sessionId).translator.answer(input.itemId, input.optionId)
  }

  setOption = async (): Promise<Readonly<Record<string, string>>> => {
    throw new Error('OpenCode 2 session options are not available yet.')
  }

  historyFilePath = async (): Promise<null> => null

  closeSession = (sessionId: string): Promise<boolean> => this.close(sessionId, true)
  forceCloseSession = (sessionId: string): Promise<boolean> => this.close(sessionId, true)
  disposeSession = (sessionId: string): Promise<boolean> => this.close(sessionId, true)
  releaseAcquisition = (input: { sessionId: string }): Promise<boolean> =>
    this.close(input.sessionId, true)

  async closeAll(): Promise<void> {
    const results = await Promise.all(
      [...this.sessions.keys()].map((sessionId) => this.close(sessionId, true))
    )
    if (results.some((stopped) => !stopped)) {
      throw new Error('One or more OpenCode 2 servers could not be stopped.')
    }
  }

  private async openProviderSession(
    connection: OpenCode2ServerConnection,
    identity: AgentSessionJournalIdentity,
    cwd: string
  ): Promise<string> {
    const existing =
      identity.providerHandle.kind === 'opaque' && identity.providerHandle.agent === 'opencode2'
        ? identity.providerHandle.value
        : null
    if (existing && existing !== 'pending') {
      const session = await connection.client.get<{ id: string }>(
        `/api/session/${encodeURIComponent(existing)}`
      )
      return session.id
    }
    const session = await connection.client.post<{ id: string }>('/api/session', {
      location: { directory: cwd }
    })
    return session.id
  }

  private async close(sessionId: string, requested: boolean): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return true
    }
    session.requestedClose = requested
    session.monitor.stop()
    const stopped = await session.connection.close()
    if (stopped) {
      this.sessions.delete(sessionId)
    }
    return stopped
  }

  private handleUnexpectedExit(sessionId: string, generation: string, error: Error): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.requestedClose || session.acquisitionGeneration !== generation) {
      return
    }
    session.monitor.stop()
    this.deps.onEvent?.({
      type: 'ended',
      sessionId,
      reason: error.message,
      cause: 'unexpected-exit',
      fence: session.fence,
      acquisitionGeneration: generation,
      observedAt: this.deps.now?.() ?? Date.now()
    })
  }

  private async readStartTime(pid: number | undefined): Promise<number> {
    if (!pid) {
      throw new Error('OpenCode 2 server started without a pid.')
    }
    const value = await (this.deps.readProcessStartTime ?? readProcessStartTimeMs)(pid)
    if (value === null) {
      throw new Error(`OpenCode 2 server start time for pid ${pid} could not be read.`)
    }
    return value
  }

  private providerHandleLink(
    providerSessionId: string,
    input: StructuredAgentSessionAcquireInput,
    resumed: boolean
  ): AgentSessionProviderHandleLink {
    return {
      linkId: `opencode2-${input.fence}-${providerSessionId}`.slice(0, 128),
      handle: { provider: 'opencode2', sessionId: providerSessionId },
      origin: resumed ? 'resumed' : 'created',
      mintedAtFence: input.fence,
      observedAt: this.deps.now?.() ?? Date.now()
    }
  }

  private session(sessionId: string): OpenCode2Session {
    const session = this.sessions.get(sessionId)
    if (!session || session.connection.closed) {
      throw new Error(`no live OpenCode 2 server for session ${sessionId}`)
    }
    return session
  }

  private noopSink(): NonNullable<StructuredAgentSessionAcquireInput['events']> {
    return { appendItem: () => {}, appendTombstone: () => {}, publish: () => {} }
  }
}
