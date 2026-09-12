import type { AgentSessionSlashCommand } from '../../shared/agent-session-wire'
import type { OpenCode2Command } from './opencode2-api-types'
import type { OpenCode2HttpClient } from './opencode2-http-client'

export async function readOpenCode2SessionCommands(
  client: OpenCode2HttpClient
): Promise<AgentSessionSlashCommand[]> {
  const commands = await client.get<OpenCode2Command[]>('/api/command')
  return commands.map((command) => ({
    name: command.name,
    kind: 'command',
    ...(command.description ? { description: command.description } : {})
  }))
}

export function parseOpenCode2SessionCommand(
  text: string,
  commands: readonly AgentSessionSlashCommand[]
): { command: string; text: string } | null {
  const match = /^\/([^\s]+)(?:\s+(.*))?$/.exec(text.trimEnd())
  if (!match || !commands.some((entry) => entry.kind === 'command' && entry.name === match[1])) {
    return null
  }
  return { command: match[1]!, text: match[2]?.trim() ?? '' }
}
