import { describe, expect, it, vi } from 'vitest'
import { agentJournalItemKey } from '../../shared/agent-session-journal-item-key'
import { encodeAgentSessionQuestionAnswers } from '../../shared/agent-session-question-answer'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'
import type { StructuredAgentSessionEventSink } from '../native-chat/agent-session-wire/structured-agent-session-event-sink'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import { OpenCode2JournalTranslator } from './opencode2-journal-translation'

function harness() {
  const items: { identity: AgentJournalItemIdentity; body: AgentJournalItemBody }[] = []
  const post = vi.fn(async () => undefined)
  const messages = [
    {
      id: 'msg-user',
      type: 'user',
      text: 'Hello',
      metadata: { orcaClientMessageId: 'client-1' },
      time: { created: 10 }
    },
    {
      id: 'msg-assistant',
      type: 'assistant',
      time: { created: 20, completed: 30 },
      content: [
        { type: 'reasoning', text: 'Thinking' },
        { type: 'text', text: 'Done' },
        {
          type: 'tool',
          id: 'tool-1',
          name: 'read',
          state: { status: 'completed', input: { path: 'README.md' } }
        }
      ]
    }
  ]
  const client: OpenCode2HttpClient = {
    get: vi.fn(async (path: string) => {
      if (path.includes('/message?')) {
        return messages
      }
      if (path.endsWith('/permission')) {
        return [
          {
            id: 'permission-1',
            sessionID: 'ses-provider',
            action: 'read',
            resources: ['README.md']
          }
        ]
      }
      return [
        {
          id: 'form-1',
          sessionID: 'ses-provider',
          title: 'Choose',
          fields: [
            {
              key: 'color',
              type: 'string',
              title: 'Color',
              options: [{ value: 'blue', label: 'Blue' }]
            }
          ]
        }
      ]
    }) as OpenCode2HttpClient['get'],
    getEnvelope: (async () => ({
      data: messages,
      cursor: { next: null }
    })) as OpenCode2HttpClient['getEnvelope'],
    post: post as OpenCode2HttpClient['post'],
    events: async function* () {}
  }
  const sink: StructuredAgentSessionEventSink = {
    appendItem: (identity, body) => items.push({ identity, body }),
    appendTombstone: () => {},
    publish: vi.fn()
  }
  return { client, items, post, sink }
}

describe('OpenCode2JournalTranslator', () => {
  it('projects messages, tools, turns, permissions, and forms', async () => {
    const { client, items, sink } = harness()
    const translator = new OpenCode2JournalTranslator(client, 'ses-provider', sink)

    await translator.refresh()
    await translator.refresh()

    expect(items.map((item) => item.body.kind)).toEqual([
      'message',
      'message',
      'message',
      'tool-call',
      'turn',
      'approval',
      'question'
    ])
    expect(items.find((item) => item.body.kind === 'turn')?.body).toMatchObject({
      state: 'completed',
      userItemId: expect.stringContaining('client-1')
    })
    expect(items.find((item) => item.body.kind === 'tool-call')?.body).toMatchObject({
      name: 'read',
      state: 'completed'
    })
  })

  it('routes prompt answers to the matching OpenCode 2 endpoint', async () => {
    const { client, items, post, sink } = harness()
    const translator = new OpenCode2JournalTranslator(client, 'ses-provider', sink)
    await translator.refresh()
    const approval = items.find((item) => item.body.kind === 'approval')!
    const question = items.find((item) => item.body.kind === 'question')!

    await translator.answer(agentJournalItemKey(approval.identity), 'once')
    await translator.answer(
      agentJournalItemKey(question.identity),
      encodeAgentSessionQuestionAnswers([{ questionId: 'color', optionIds: ['blue'] }])
    )

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/api/session/ses-provider/permission/permission-1/reply',
      { reply: 'once' }
    )
    expect(post).toHaveBeenNthCalledWith(2, '/api/session/ses-provider/form/form-1/reply', {
      answer: { color: 'blue' }
    })
  })

  it('honors the OpenCode 2 auto-approval launch mode', async () => {
    const { client, items, post, sink } = harness()
    const translator = new OpenCode2JournalTranslator(client, 'ses-provider', sink, true)

    await translator.refresh()

    expect(items.some((item) => item.body.kind === 'approval')).toBe(false)
    expect(post).toHaveBeenCalledWith('/api/session/ses-provider/permission/permission-1/reply', {
      reply: 'once'
    })
  })
})
