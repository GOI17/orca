import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import { decodeAgentSessionQuestionAnswers } from '../../shared/agent-session-question-answer'
import {
  boundPayload,
  boundToolInput,
  DEFAULT_JOURNAL_PAYLOAD_LIMITS
} from '../native-chat/agent-session-journal/journal-payload-bounds'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import type {
  OpenCode2ActiveSessions,
  OpenCode2Form,
  OpenCode2FormField,
  OpenCode2Message,
  OpenCode2Permission
} from './opencode2-api-types'
import { openCode2ToolOutputText } from './opencode2-tool-output'
import { OpenCode2ActiveTurnProjection } from './opencode2-active-turn-projection'
import { openCode2FormOptions } from './opencode2-form-options'

type PromptTarget =
  | { kind: 'permission'; requestId: string }
  | { kind: 'form'; formId: string; fields: OpenCode2FormField[] }

export class OpenCode2JournalTranslator {
  private readonly seen = new Map<string, string>()
  private readonly promptTargets = new Map<string, PromptTarget>()
  private readonly activeTurn = new OpenCode2ActiveTurnProjection()
  private hydrated = false

  constructor(
    private readonly client: OpenCode2HttpClient,
    private readonly providerSessionId: string,
    private readonly sink: StructuredAgentSessionEventSink,
    private readonly autoApprove = false
  ) {}

  async refresh(): Promise<void> {
    const [{ messages, truncated }, permissions, forms, activeSessions] = await Promise.all([
      this.readMessages(),
      this.client.get<OpenCode2Permission[]>(
        `/api/session/${encodeURIComponent(this.providerSessionId)}/permission`
      ),
      this.client.get<OpenCode2Form[]>(
        `/api/session/${encodeURIComponent(this.providerSessionId)}/form`
      ),
      this.client.get<OpenCode2ActiveSessions>('/api/session/active')
    ])
    this.appendMessages(messages, this.providerSessionId in activeSessions)
    if (truncated) {
      this.append(this.identity('history:truncated'), {
        kind: 'status',
        text: 'Earlier OpenCode 2 history is not shown because the session exceeded the 10,000-message import limit.'
      })
    }
    for (const permission of permissions) {
      if (this.autoApprove) {
        await this.client.post(
          `/api/session/${encodeURIComponent(this.providerSessionId)}/permission/${encodeURIComponent(permission.id)}/reply`,
          { reply: 'once' }
        )
      } else {
        this.appendPermission(permission)
      }
    }
    for (const form of forms) {
      this.appendForm(form)
    }
    this.sink.publish()
  }

  async answer(itemId: string, optionId: string): Promise<void> {
    const target = this.promptTargets.get(itemId)
    if (!target) {
      throw new Error('OpenCode 2 prompt is no longer pending.')
    }
    if (target.kind === 'permission') {
      if (optionId !== 'once' && optionId !== 'always' && optionId !== 'reject') {
        throw new Error('OpenCode 2 permission answer is invalid.')
      }
      await this.client.post(
        `/api/session/${encodeURIComponent(this.providerSessionId)}/permission/${encodeURIComponent(target.requestId)}/reply`,
        { reply: optionId }
      )
      return
    }
    const decoded = decodeAgentSessionQuestionAnswers(optionId)
    if (!decoded) {
      throw new Error('OpenCode 2 form answer is invalid.')
    }
    const answer: Record<string, string | boolean | string[]> = {}
    for (const item of decoded) {
      const field = target.fields.find((candidate) => candidate.key === item.questionId)
      if (!field) {
        continue
      }
      const values = item.other?.trim() ? [...item.optionIds, item.other.trim()] : item.optionIds
      answer[field.key] =
        field.type === 'boolean'
          ? values[0] === 'true'
          : field.type === 'multiselect'
            ? values
            : (values[0] ?? '')
    }
    await this.client.post(
      `/api/session/${encodeURIComponent(this.providerSessionId)}/form/${encodeURIComponent(target.formId)}/reply`,
      { answer }
    )
  }

  private async readMessages(): Promise<{ messages: OpenCode2Message[]; truncated: boolean }> {
    if (this.hydrated) {
      const messages = await this.client.get<OpenCode2Message[]>(
        `/api/session/${encodeURIComponent(this.providerSessionId)}/message?limit=200&order=desc`
      )
      return { messages: this.orderMessages(messages), truncated: false }
    }
    const messages: OpenCode2Message[] = []
    let cursor: string | null | undefined
    for (let page = 0; page < 50; page += 1) {
      const query = new URLSearchParams({ limit: '200', order: 'asc' })
      if (cursor) {
        query.set('cursor', cursor)
      }
      const response = await this.client.getEnvelope<OpenCode2Message[]>(
        `/api/session/${encodeURIComponent(this.providerSessionId)}/message?${query}`
      )
      messages.push(...response.data)
      cursor = response.cursor?.next
      if (!cursor) {
        this.hydrated = true
        return { messages: this.orderMessages(messages), truncated: false }
      }
    }
    this.hydrated = true
    return { messages: this.orderMessages(messages), truncated: true }
  }

  private orderMessages(messages: OpenCode2Message[]): OpenCode2Message[] {
    return messages.sort((left, right) => (left.time?.created ?? 0) - (right.time?.created ?? 0))
  }

  private appendMessages(messages: OpenCode2Message[], active: boolean): void {
    let latestUserItemId: string | undefined
    const latestAssistantId = messages.findLast((message) => message.type === 'assistant')?.id
    let hasRunningAssistant = false
    for (const message of messages) {
      if (message.type === 'user' && typeof message.text === 'string') {
        const clientMessageId = message.metadata?.orcaClientMessageId
        const identity = this.identity(
          typeof clientMessageId === 'string' ? clientMessageId : `message:${message.id}`
        )
        this.append(
          identity,
          { kind: 'message', role: 'user', blocks: [{ type: 'text', text: message.text }] },
          message.time?.created
        )
        latestUserItemId = agentJournalItemKey(identity)
        continue
      }
      if (message.type !== 'assistant') {
        continue
      }
      this.appendAssistant(message)
      const running = active && message.id === latestAssistantId
      hasRunningAssistant ||= running
      const turnIdentity = this.identity(`turn:${message.id}`)
      this.append(
        turnIdentity,
        {
          kind: 'turn',
          turnId: message.id,
          state: running ? 'running' : message.error ? 'interrupted' : 'completed',
          ...(latestUserItemId ? { userItemId: latestUserItemId } : {}),
          ...(message.time?.created ? { startedAt: message.time.created } : {}),
          ...(message.time?.completed ? { completedAt: message.time.completed } : {})
        },
        message.time?.created
      )
    }
    this.activeTurn.sync({
      active,
      hasRunningAssistant,
      ...(latestUserItemId ? { userItemId: latestUserItemId } : {}),
      identity: (recordId) => this.identity(recordId),
      append: (identity, body, observedAt) => this.append(identity, body, observedAt)
    })
  }

  private appendAssistant(message: OpenCode2Message): void {
    for (const [ordinal, content] of (message.content ?? []).entries()) {
      const recordId = `message:${message.id}:${content.type}:${content.id ?? ordinal}`
      if ((content.type === 'text' || content.type === 'reasoning') && content.text) {
        this.append(
          this.identity(recordId),
          {
            kind: 'message',
            role: content.type === 'reasoning' ? 'reasoning' : 'assistant',
            blocks: [{ type: 'text', text: content.text }]
          },
          content.time?.created ?? message.time?.created
        )
      } else if (content.type === 'tool') {
        const status = content.state?.status
        const output = openCode2ToolOutputText(content.state?.content ?? content.state?.error)
        this.append(
          this.identity(recordId),
          {
            kind: 'tool-call',
            name: content.name ?? 'tool',
            input: boundToolInput(content.state?.input ?? null, DEFAULT_JOURNAL_PAYLOAD_LIMITS),
            ...(content.id ? { callId: content.id } : {}),
            state: status === 'error' ? 'failed' : status === 'completed' ? 'completed' : 'running',
            ...(output ? { output: boundPayload(output, DEFAULT_JOURNAL_PAYLOAD_LIMITS) } : {})
          },
          content.time?.created ?? message.time?.created
        )
      }
    }
  }

  private appendPermission(permission: OpenCode2Permission): void {
    const identity = this.identity(`permission:${permission.id}`)
    this.append(identity, {
      kind: 'approval',
      title: permission.message || permission.action,
      detail: permission.resources?.join('\n') || null,
      options: [
        { id: 'once', label: 'Allow once' },
        { id: 'always', label: 'Always allow' },
        { id: 'reject', label: 'Reject' }
      ],
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    })
    this.promptTargets.set(agentJournalItemKey(identity), {
      kind: 'permission',
      requestId: permission.id
    })
  }

  private appendForm(form: OpenCode2Form): void {
    const identity = this.identity(`form:${form.id}`)
    const questions = form.fields
      .filter((field) => field.type !== 'external')
      .map((field) => ({
        id: field.key,
        question: field.title || field.description || field.key,
        multiSelect: field.type === 'multiselect',
        options: openCode2FormOptions(field),
        ...(field.type === 'string' || field.type === 'number' || field.type === 'integer'
          ? { freeTextQuestionId: field.key }
          : {})
      }))
    this.append(identity, {
      kind: 'question',
      question: form.title,
      options: questions.length === 1 ? questions[0]!.options : [],
      questions,
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    })
    this.promptTargets.set(agentJournalItemKey(identity), {
      kind: 'form',
      formId: form.id,
      fields: form.fields
    })
  }

  private identity(recordId: string): AgentJournalItemIdentity {
    return { provider: 'legacy', agent: 'opencode2', sessionId: this.providerSessionId, recordId }
  }

  private append(
    identity: AgentJournalItemIdentity,
    body: AgentJournalItemBody,
    observedAt?: number
  ): void {
    const key = agentJournalItemKey(identity)
    const encoded = JSON.stringify(body)
    if (this.seen.get(key) === encoded) {
      return
    }
    this.seen.set(key, encoded)
    this.sink.appendItem(identity, body, {
      ...(observedAt ? { observedAt } : {}),
      coalescingKey: key
    })
  }
}
