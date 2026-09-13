import { beforeEach, describe, expect, it, vi } from 'vitest'
import { launchPersonalChat } from './personal-chat-launch'
import { settleStructuredAgentLaunch } from '@/lib/structured-agent-launch-settlement'

const mocks = vi.hoisted(() => ({
  setState: vi.fn(),
  updateSettings: vi.fn(),
  directory: vi.fn(),
  state: { settings: { personalChatsEnabled: false, activeRuntimeEnvironmentId: 'remote-host' } }
}))
vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => ({ ...mocks.state, updateSettingsOrThrow: mocks.updateSettings }),
    setState: mocks.setState
  }
}))
vi.mock('@/lib/structured-agent-launch-settlement', () => ({
  settleStructuredAgentLaunch: vi.fn()
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', { api: { app: { getPersonalChatDirectory: mocks.directory } } })
  mocks.state.settings.personalChatsEnabled = false
  mocks.directory.mockResolvedValue('/app-data/personal-chats')
  mocks.updateSettings.mockResolvedValue(undefined)
  vi.mocked(settleStructuredAgentLaunch).mockResolvedValue({
    kind: 'structured',
    sessionId: 'chat-1'
  })
})

describe('launchPersonalChat', () => {
  it.each(['codex', 'claude'] as const)(
    'opens %s locally without changing project chat preferences',
    async (agent) => {
      expect(await launchPersonalChat(agent)).toBe('chat-1')
      expect(mocks.updateSettings).toHaveBeenCalledWith({ personalChatsEnabled: true })
      expect(mocks.setState).toHaveBeenCalledWith({
        personalChatDirectory: '/app-data/personal-chats'
      })
      expect(settleStructuredAgentLaunch).toHaveBeenCalledWith('personal-chats', agent, {}, {})
      expect(mocks.state.settings.activeRuntimeEnvironmentId).toBe('remote-host')
    }
  )

  it('does not launch when enabling the session engine fails', async () => {
    mocks.updateSettings.mockRejectedValue(new Error('Could not save settings'))
    await expect(launchPersonalChat('codex')).rejects.toThrow('Could not save settings')
    expect(settleStructuredAgentLaunch).not.toHaveBeenCalled()
  })

  it('reports an uncertain launch without starting a replacement session', async () => {
    mocks.state.settings.personalChatsEnabled = true
    vi.mocked(settleStructuredAgentLaunch).mockResolvedValue({
      kind: 'visibility-unknown',
      sessionId: 'chat-1'
    })
    await expect(launchPersonalChat('codex')).rejects.toThrow(
      'Retry to reconnect to the same session'
    )
    expect(settleStructuredAgentLaunch).toHaveBeenCalledTimes(1)
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })
})
