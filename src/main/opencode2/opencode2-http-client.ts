export type OpenCode2HttpClient = {
  get<T>(path: string): Promise<T>
  getEnvelope<T>(path: string): Promise<{ data: T; cursor?: { next?: string | null } }>
  post<T>(path: string, body?: unknown): Promise<T>
  events(signal: AbortSignal): AsyncIterable<unknown>
}

const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
const MAX_ERROR_BYTES = 8 * 1024
const MAX_EVENT_BUFFER_BYTES = 1024 * 1024

export function createOpenCode2HttpClient(baseUrl: string, password: string): OpenCode2HttpClient {
  const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`

  async function request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    unwrapData = true
  ): Promise<T> {
    const response = await fetch(new URL(path, baseUrl), {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        authorization,
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    if (!response.ok) {
      const detail = await readBoundedResponseText(response, MAX_ERROR_BYTES).catch(() => '')
      throw new Error(
        `OpenCode 2 API ${method} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`
      )
    }
    if (response.status === 204) {
      return undefined as T
    }
    const decoded = JSON.parse(await readBoundedResponseText(response, MAX_RESPONSE_BYTES)) as
      | { data?: T }
      | T
    return unwrapData && decoded && typeof decoded === 'object' && 'data' in decoded
      ? (decoded as { data: T }).data
      : (decoded as T)
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    getEnvelope: <T>(path: string) =>
      request<{ data: T; cursor?: { next?: string | null } }>('GET', path, undefined, false),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    events: (signal: AbortSignal) => subscribeOpenCode2Events(baseUrl, authorization, signal)
  }
}

async function* subscribeOpenCode2Events(
  baseUrl: string,
  authorization: string,
  signal: AbortSignal
): AsyncIterable<unknown> {
  const response = await fetch(new URL('/api/event', baseUrl), {
    headers: { authorization },
    signal
  })
  if (!response.ok || !response.body) {
    throw new Error(`OpenCode 2 event stream failed (${response.status}).`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        return
      }
      pending += decoder.decode(next.value, { stream: true }).replaceAll('\r\n', '\n')
      if (Buffer.byteLength(pending, 'utf8') > MAX_EVENT_BUFFER_BYTES) {
        throw new Error('OpenCode 2 event frame exceeded the safety limit.')
      }
      let boundary = pending.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = pending.slice(0, boundary)
        pending = pending.slice(boundary + 2)
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (data) {
          yield JSON.parse(data) as unknown
        }
        boundary = pending.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

async function readBoundedResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    return ''
  }
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error('OpenCode 2 API response exceeded the safety limit.')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) {
        return text + decoder.decode()
      }
      bytes += next.value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel()
        throw new Error('OpenCode 2 API response exceeded the safety limit.')
      }
      text += decoder.decode(next.value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}
