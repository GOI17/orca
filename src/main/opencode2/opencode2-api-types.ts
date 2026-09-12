export type OpenCode2Permission = {
  id: string
  sessionID: string
  action: string
  resources?: string[]
  message?: string
}

export type OpenCode2FormField = {
  key: string
  type: string
  title?: string
  description?: string
  options?: { value: string; label: string; description?: string }[]
}

export type OpenCode2Form = {
  id: string
  sessionID: string
  title: string
  fields: OpenCode2FormField[]
}

export type OpenCode2ModelRef = {
  id: string
  providerID: string
  variant?: string
}

export type OpenCode2Model = OpenCode2ModelRef & {
  modelID: string
  name: string
  enabled: boolean
  variants: { id: string }[]
}

export type OpenCode2SessionInfo = {
  id: string
  model?: OpenCode2ModelRef
}

export type OpenCode2Command = {
  name: string
  description?: string
}

export type OpenCode2ActiveSessions = Record<string, { type: 'running' }>

export type OpenCode2MessageContent = {
  type: string
  id?: string
  name?: string
  text?: string
  state?: { status?: string; input?: unknown; content?: unknown; error?: unknown }
  time?: { created?: number }
}

export type OpenCode2Message = {
  id: string
  type: string
  text?: string
  metadata?: Record<string, unknown>
  time?: { created?: number; completed?: number }
  content?: OpenCode2MessageContent[]
  finish?: string
  error?: unknown
}
