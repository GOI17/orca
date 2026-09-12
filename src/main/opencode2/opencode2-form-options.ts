import type { AgentJournalPromptOption } from '../../shared/agent-session-journal-types'
import type { OpenCode2FormField } from './opencode2-api-types'

export function openCode2FormOptions(field: OpenCode2FormField): AgentJournalPromptOption[] {
  if (field.type === 'boolean') {
    return [
      { id: 'true', label: 'Yes' },
      { id: 'false', label: 'No' }
    ]
  }
  return (field.options ?? []).map((option) => ({
    id: option.value,
    label: option.label,
    ...(option.description ? { description: option.description } : {})
  }))
}
