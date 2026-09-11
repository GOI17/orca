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
