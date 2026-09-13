export const PERSONAL_CHATS_WORKSPACE_ID = 'personal-chats'

export function isPersonalChatsSelector(selector: string): boolean {
  return (
    selector === PERSONAL_CHATS_WORKSPACE_ID || selector === `id:${PERSONAL_CHATS_WORKSPACE_ID}`
  )
}
