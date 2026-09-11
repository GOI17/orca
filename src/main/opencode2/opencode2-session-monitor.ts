import type { OpenCode2HttpClient } from './opencode2-http-client'
import type { OpenCode2JournalTranslator } from './opencode2-journal-translation'

export class OpenCode2SessionMonitor {
  private timer: ReturnType<typeof setTimeout> | null = null
  private refreshing = false
  private refreshAgain = false
  private readonly controller = new AbortController()

  constructor(
    private readonly sessionId: string,
    private readonly providerSessionId: string,
    private readonly client: OpenCode2HttpClient,
    private readonly translator: OpenCode2JournalTranslator,
    private readonly pollIntervalMs: number
  ) {}

  start(): void {
    this.schedule()
    void this.subscribeEvents()
  }

  async refresh(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true
      return
    }
    this.refreshing = true
    try {
      do {
        this.refreshAgain = false
        await this.translator.refresh()
      } while (this.refreshAgain && !this.controller.signal.aborted)
    } catch (error) {
      if (!this.controller.signal.aborted) {
        console.warn(`[opencode2] refresh failed for ${this.sessionId}`, error)
      }
    } finally {
      this.refreshing = false
    }
  }

  stop(): void {
    this.controller.abort()
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = null
  }

  private schedule(): void {
    if (this.timer || this.controller.signal.aborted) {
      return
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.refresh().finally(() => this.schedule())
    }, this.pollIntervalMs)
    this.timer.unref?.()
  }

  private async subscribeEvents(): Promise<void> {
    try {
      for await (const event of this.client.events(this.controller.signal)) {
        if (eventBelongsToSession(event, this.providerSessionId)) {
          void this.refresh()
        }
      }
    } catch (error) {
      if (!this.controller.signal.aborted) {
        console.warn(`[opencode2] event stream failed for ${this.sessionId}`, error)
      }
    }
  }
}

function eventBelongsToSession(event: unknown, providerSessionId: string): boolean {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return false
  }
  const data = (event as { data?: unknown }).data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false
  }
  const record = data as Record<string, unknown>
  if (record.sessionID === providerSessionId) {
    return true
  }
  const form = record.form
  return (
    !!form &&
    typeof form === 'object' &&
    (form as { sessionID?: unknown }).sessionID === providerSessionId
  )
}
