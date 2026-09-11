import type { AgentSessionAccountHome } from './agent-session-record'

const MAX_ACCOUNT_HOME_PATH_LENGTH = 4096

export function isAgentSessionAccountHome(value: unknown): value is AgentSessionAccountHome {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const home = value as Partial<AgentSessionAccountHome>
  return (
    (home.variable === 'CLAUDE_CONFIG_DIR' ||
      home.variable === 'CODEX_HOME' ||
      home.variable === 'OPENCODE_CONFIG_DIR') &&
    typeof home.path === 'string' &&
    home.path.length > 0 &&
    home.path.length <= MAX_ACCOUNT_HOME_PATH_LENGTH
  )
}
