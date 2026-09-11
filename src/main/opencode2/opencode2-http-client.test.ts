import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenCode2HttpClient } from './opencode2-http-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createOpenCode2HttpClient', () => {
  it('authenticates requests and unwraps API data', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _options?: RequestInit) =>
        new Response(JSON.stringify({ data: { id: 'ses_one' } }), {
          headers: { 'content-type': 'application/json' }
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = createOpenCode2HttpClient('http://127.0.0.1:4096', 'secret')

    await expect(client.post('/api/session', { title: 'Test' })).resolves.toEqual({ id: 'ses_one' })

    const [, options] = fetchMock.mock.calls[0]!
    expect(options?.headers).toMatchObject({
      authorization: `Basic ${Buffer.from('opencode:secret').toString('base64')}`,
      'content-type': 'application/json'
    })
  })

  it('retains pagination cursors for history hydration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ data: [{ id: 'msg_one' }], cursor: { next: 'next-page' } }),
            { headers: { 'content-type': 'application/json' } }
          )
      )
    )
    const client = createOpenCode2HttpClient('http://127.0.0.1:4096', 'secret')

    await expect(client.getEnvelope('/api/session/ses_one/message')).resolves.toEqual({
      data: [{ id: 'msg_one' }],
      cursor: { next: 'next-page' }
    })
  })

  it('decodes split server-sent event frames', async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"session.'))
        controller.enqueue(encoder.encode('idle","data":{"sessionID":"ses_one"}}\n\n'))
        controller.close()
      }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }))
    )
    const client = createOpenCode2HttpClient('http://127.0.0.1:4096', 'secret')
    const events: unknown[] = []

    for await (const event of client.events(new AbortController().signal)) {
      events.push(event)
    }

    expect(events).toEqual([{ type: 'session.idle', data: { sessionID: 'ses_one' } }])
  })
})
