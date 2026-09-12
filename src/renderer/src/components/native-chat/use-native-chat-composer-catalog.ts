import { useMemo } from 'react'
import type { AgentType } from '../../../../shared/agent-status-types'
import { getVerifiedNativeChatCommands } from '../../../../shared/native-chat-agent-profiles'
import {
  sessionReportedSkillNames,
  sessionSlashCommandSuggestions,
  type SlashCommandSuggestion
} from '../../../../shared/native-chat-slash-commands'
import { structuredSlashCommands } from '../../../../shared/structured-agent-session-composer'
import type { NativeChatStructuredComposerTransport } from './native-chat-composer-types'

export type NativeChatComposerCatalog = {
  agentCommands: readonly SlashCommandSuggestion[]
  sessionSkillNames: readonly string[] | undefined
}

function reportedCommands(
  agent: AgentType,
  reported: NonNullable<NativeChatStructuredComposerTransport['sessionCommands']>,
  conversationCommands: NativeChatStructuredComposerTransport['conversationCommands']
): readonly SlashCommandSuggestion[] {
  const provider = sessionSlashCommandSuggestions(agent, reported)
  if (agent !== 'opencode2') {
    return provider
  }
  const host = structuredSlashCommands(conversationCommands, agent)
  const hostNames = new Set(host.map((command) => command.name))
  return [...host, ...provider.filter((command) => !hostNames.has(command.name))]
}

/**
 * What the `/` menu offers. A structured session reports the surface it actually
 * loaded — the only list that includes this repo's own commands and the skills
 * that reach the session through plugin roots — so it wins whenever it is
 * present. OpenCode's API reports project commands only, so its host-owned
 * model/conversation actions are merged in. The curated per-agent catalog
 * remains the answer for the PTY lane and for a host that predates the report.
 */
export function useNativeChatComposerCatalog(
  agent: AgentType,
  structuredTransport?: NativeChatStructuredComposerTransport
): NativeChatComposerCatalog {
  const structured = Boolean(structuredTransport)
  const reported = structuredTransport?.sessionCommands
  const conversationCommands = structuredTransport?.conversationCommands
  const agentCommands = useMemo(
    () =>
      !structured
        ? getVerifiedNativeChatCommands(agent)
        : reported !== undefined
          ? reportedCommands(agent, reported, conversationCommands)
          : structuredSlashCommands(conversationCommands, agent),
    [agent, conversationCommands, reported, structured]
  )
  const sessionSkillNames = useMemo(
    () => (reported !== undefined ? sessionReportedSkillNames(reported) : undefined),
    [reported]
  )
  return { agentCommands, sessionSkillNames }
}
