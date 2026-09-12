import { randomUUID } from 'node:crypto'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../shared/agent-session-journal-types'

type Append = (
  identity: AgentJournalItemIdentity,
  body: AgentJournalItemBody,
  observedAt?: number
) => void

export class OpenCode2ActiveTurnProjection {
  private placeholder: {
    identity: AgentJournalItemIdentity
    turnId: string
    startedAt: number
    userItemId?: string
  } | null = null

  sync(input: {
    active: boolean
    hasRunningAssistant: boolean
    userItemId?: string
    identity: (recordId: string) => AgentJournalItemIdentity
    append: Append
  }): void {
    if (input.active && !input.hasRunningAssistant && !this.placeholder) {
      const turnId = `pending:${randomUUID()}`
      this.placeholder = {
        identity: input.identity(`turn:${turnId}`),
        turnId,
        startedAt: Date.now(),
        ...(input.userItemId ? { userItemId: input.userItemId } : {})
      }
      input.append(this.placeholder.identity, this.body('running'))
      return
    }
    if ((!input.active || input.hasRunningAssistant) && this.placeholder) {
      input.append(this.placeholder.identity, this.body('completed'))
      this.placeholder = null
    }
  }

  private body(state: 'running' | 'completed'): AgentJournalItemBody {
    const placeholder = this.placeholder!
    return {
      kind: 'turn',
      turnId: placeholder.turnId,
      state,
      startedAt: placeholder.startedAt,
      ...(state === 'completed' ? { completedAt: Date.now() } : {}),
      ...(placeholder.userItemId ? { userItemId: placeholder.userItemId } : {})
    }
  }
}
