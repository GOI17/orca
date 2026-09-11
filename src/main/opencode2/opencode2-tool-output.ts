export function openCode2ToolOutputText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (Array.isArray(value)) {
    const text = value
      .flatMap((entry) =>
        entry && typeof entry === 'object' && typeof (entry as { text?: unknown }).text === 'string'
          ? [(entry as { text: string }).text]
          : []
      )
      .join('\n')
    return text || null
  }
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable tool output]'
  }
}
