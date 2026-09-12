import type { AgentSessionSlashCommand } from '../../shared/agent-session-wire'
import type { OpenCode2Command, OpenCode2Skill } from './opencode2-api-types'
import type { OpenCode2HttpClient } from './opencode2-http-client'

export type OpenCode2SessionCommandCatalog = {
  entries: AgentSessionSlashCommand[]
  skillIds: ReadonlyMap<string, string>
}

export async function readOpenCode2SessionCommands(
  client: OpenCode2HttpClient
): Promise<OpenCode2SessionCommandCatalog> {
  const [commands, skills] = await Promise.all([
    client.get<OpenCode2Command[]>('/api/command'),
    client.get<OpenCode2Skill[]>('/api/skill')
  ])
  const slashSkills = skills.filter((skill) => skill.slash === true)
  return {
    entries: [
      ...commands.map((command) => ({
        name: command.name,
        kind: 'command' as const,
        ...(command.description ? { description: command.description } : {})
      })),
      ...slashSkills.map((skill) => ({
        name: skill.id,
        kind: 'skill' as const,
        ...(skill.description ? { description: skill.description } : {})
      }))
    ],
    skillIds: new Map(slashSkills.map((skill) => [skill.id, skill.id]))
  }
}

export function parseOpenCode2SessionAction(
  text: string,
  catalog: OpenCode2SessionCommandCatalog
):
  | { kind: 'command'; command: string; text: string }
  | { kind: 'skill'; skill: string; text: string }
  | null {
  const match = /^\/([^\s]+)(?:\s+(.*))?$/.exec(text.trimEnd())
  if (!match) {
    return null
  }
  const name = match[1]!
  const argument = match[2]?.trim() ?? ''
  if (catalog.entries.some((entry) => entry.kind === 'command' && entry.name === name)) {
    return { kind: 'command', command: name, text: argument }
  }
  const skill = catalog.skillIds.get(name)
  return skill ? { kind: 'skill', skill, text: argument } : null
}
