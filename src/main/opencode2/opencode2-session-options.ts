import type {
  AgentSessionModelOption,
  AgentSessionOptionChoice,
  AgentSessionOptionsResult
} from '../../shared/agent-session-wire'
import { AgentSessionOptionRejectedError } from '../native-chat/agent-session-wire/structured-agent-session-option-error'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import type { OpenCode2Model, OpenCode2ModelRef, OpenCode2SessionInfo } from './opencode2-api-types'

function modelKey(model: OpenCode2ModelRef): string {
  return `${encodeURIComponent(model.providerID)}/${encodeURIComponent(model.id)}`
}

function parseModelKey(value: string): OpenCode2ModelRef | null {
  const separator = value.indexOf('/')
  if (separator <= 0 || separator === value.length - 1) {
    return null
  }
  try {
    return {
      providerID: decodeURIComponent(value.slice(0, separator)),
      id: decodeURIComponent(value.slice(separator + 1))
    }
  } catch {
    return null
  }
}

function effortLabel(value: string): string {
  return value === 'xhigh'
    ? 'Extra high'
    : value === 'none'
      ? 'None'
      : `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function effortChoices(model: OpenCode2Model): AgentSessionOptionChoice[] {
  return model.variants.map(({ id }) => ({ value: id, label: effortLabel(id) }))
}

function option(model: OpenCode2Model, defaultKey: string | null): AgentSessionModelOption {
  return {
    id: modelKey(model),
    label: model.name,
    description: model.providerID,
    isDefault: modelKey(model) === defaultKey,
    efforts: effortChoices(model)
  }
}

async function readCatalog(client: OpenCode2HttpClient): Promise<{
  models: OpenCode2Model[]
  defaultModel: OpenCode2Model | null
}> {
  const [models, defaultModel] = await Promise.all([
    client.get<OpenCode2Model[]>('/api/model'),
    client.get<OpenCode2Model | null>('/api/model/default')
  ])
  const enabled = models.filter((model) => model.enabled)
  if (defaultModel && !enabled.some((model) => modelKey(model) === modelKey(defaultModel))) {
    enabled.unshift(defaultModel)
  }
  return { models: enabled, defaultModel }
}

export async function readOpenCode2SessionOptions(
  client: OpenCode2HttpClient,
  providerSessionId: string
): Promise<AgentSessionOptionsResult> {
  const [{ models, defaultModel }, session] = await Promise.all([
    readCatalog(client),
    client.get<OpenCode2SessionInfo>(`/api/session/${encodeURIComponent(providerSessionId)}`)
  ])
  const current = session.model ?? defaultModel
  if (!current) {
    throw new Error('OpenCode 2 returned no available model.')
  }
  const currentKey = modelKey(current)
  const entries = models.map((model) => option(model, modelKey(defaultModel ?? current)))
  if (!entries.some((model) => model.id === currentKey)) {
    entries.push({
      id: currentKey,
      label: current.id,
      description: current.providerID,
      isDefault: false,
      efforts: []
    })
  }
  return {
    models: entries,
    current: {
      model: currentKey,
      ...(current.variant ? { effort: current.variant } : {}),
      confirmed: current.variant ? ['model', 'effort'] : ['model']
    }
  }
}

export async function setOpenCode2SessionOption(input: {
  client: OpenCode2HttpClient
  providerSessionId: string
  key: string
  value: string
}): Promise<Readonly<Record<string, string>>> {
  try {
    if (input.key !== 'model' && input.key !== 'effort') {
      throw new Error(`OpenCode 2 has no session option named ${input.key}.`)
    }
    if (input.key === 'model') {
      const ref = parseModelKey(input.value)
      if (!ref) {
        throw new Error(`OpenCode 2 model ${input.value} is invalid.`)
      }
      await input.client.post(`/api/session/${encodeURIComponent(input.providerSessionId)}/model`, {
        model: ref
      })
      return { model: input.value }
    }
    const options = await readOpenCode2SessionOptions(input.client, input.providerSessionId)
    const requestedModel = options.current.model
    const ref = parseModelKey(requestedModel)
    const model = options.models.find((entry) => entry.id === requestedModel)
    if (!ref || !model) {
      throw new Error(`OpenCode 2 does not offer model ${requestedModel}.`)
    }
    if (!model.efforts.some((entry) => entry.value === input.value)) {
      throw new Error(`OpenCode 2 model ${model.label} does not offer variant ${input.value}.`)
    }
    await input.client.post(`/api/session/${encodeURIComponent(input.providerSessionId)}/model`, {
      model: { ...ref, variant: input.value }
    })
    return { model: requestedModel, effort: input.value }
  } catch (error) {
    throw new AgentSessionOptionRejectedError(error)
  }
}
