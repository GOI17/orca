import type { AgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import { PERSONAL_CHATS_WORKSPACE_ID } from '../../../../shared/personal-chats'
import { useAppStore } from '@/store'
import { settleStructuredAgentLaunch } from '@/lib/structured-agent-launch-settlement'

export async function launchPersonalChat(agent: AgentSessionHandleProvider): Promise<string> {
  const directory = await window.api.app.getPersonalChatDirectory()
  useAppStore.setState({ personalChatDirectory: directory })
  if (!useAppStore.getState().settings?.personalChatsEnabled) {
    await useAppStore.getState().updateSettingsOrThrow({ personalChatsEnabled: true })
  }
  const result = await settleStructuredAgentLaunch(PERSONAL_CHATS_WORKSPACE_ID, agent, {}, {})
  if (result.kind === 'structured') {
    return result.sessionId
  }
  if (result.kind === 'failed') {
    throw result.error
  }
  if (result.kind === 'visibility-unknown') {
    throw new Error('The chat could not be confirmed. Retry to reconnect to the same session.')
  }
  throw new Error('The chat could not be opened.')
}
