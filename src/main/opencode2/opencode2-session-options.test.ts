import { describe, expect, it, vi } from 'vitest'
import type { OpenCode2HttpClient } from './opencode2-http-client'
import { readOpenCode2SessionOptions, setOpenCode2SessionOption } from './opencode2-session-options'

function clientFor(current: { id: string; providerID: string; variant?: string } | undefined) {
  const post = vi.fn(async () => undefined)
  const get = vi.fn(async (path: string) => {
    if (path === '/api/model') {
      return [
        {
          id: 'model-a',
          modelID: 'model-a',
          providerID: 'provider-a',
          name: 'Model A',
          enabled: true,
          variants: [{ id: 'low' }, { id: 'high' }]
        },
        {
          id: 'model-b',
          modelID: 'model-b',
          providerID: 'provider-b',
          name: 'Model B',
          enabled: true,
          variants: []
        }
      ]
    }
    if (path === '/api/model/default') {
      return {
        id: 'model-a',
        modelID: 'model-a',
        providerID: 'provider-a',
        name: 'Model A',
        enabled: true,
        variants: [{ id: 'low' }, { id: 'high' }]
      }
    }
    return { id: 'ses_provider', ...(current ? { model: current } : {}) }
  })
  return {
    client: { get, post } as unknown as OpenCode2HttpClient,
    get,
    post
  }
}

describe('OpenCode 2 session options', () => {
  it('reports live models, the effective default, and model variants', async () => {
    const { client } = clientFor(undefined)

    await expect(readOpenCode2SessionOptions(client, 'ses_provider')).resolves.toEqual({
      models: [
        {
          id: 'provider-a/model-a',
          label: 'Model A',
          description: 'provider-a',
          isDefault: true,
          efforts: [
            { value: 'low', label: 'Low' },
            { value: 'high', label: 'High' }
          ]
        },
        {
          id: 'provider-b/model-b',
          label: 'Model B',
          description: 'provider-b',
          isDefault: false,
          efforts: []
        }
      ],
      current: { model: 'provider-a/model-a', confirmed: ['model'] }
    })
  })

  it('switches models through the structured option surface', async () => {
    const { client, post } = clientFor({ id: 'model-a', providerID: 'provider-a' })

    await expect(
      setOpenCode2SessionOption({
        client,
        providerSessionId: 'ses_provider',
        key: 'model',
        value: 'provider-b/model-b'
      })
    ).resolves.toEqual({ model: 'provider-b/model-b' })
    expect(post).toHaveBeenCalledWith('/api/session/ses_provider/model', {
      model: { id: 'model-b', providerID: 'provider-b' }
    })
  })

  it('switches the current model variant as reasoning effort', async () => {
    const { client, post } = clientFor({
      id: 'model-a',
      providerID: 'provider-a',
      variant: 'low'
    })

    await expect(
      setOpenCode2SessionOption({
        client,
        providerSessionId: 'ses_provider',
        key: 'effort',
        value: 'high'
      })
    ).resolves.toEqual({ model: 'provider-a/model-a', effort: 'high' })
    expect(post).toHaveBeenCalledWith('/api/session/ses_provider/model', {
      model: { id: 'model-a', providerID: 'provider-a', variant: 'high' }
    })
  })

  it('rejects unknown structured option keys before calling OpenCode', async () => {
    const { client, post } = clientFor({ id: 'model-a', providerID: 'provider-a' })

    await expect(
      setOpenCode2SessionOption({
        client,
        providerSessionId: 'ses_provider',
        key: 'unknown',
        value: 'value'
      })
    ).rejects.toThrow('OpenCode 2 has no session option named unknown.')
    expect(post).not.toHaveBeenCalled()
  })
})
