import { useEffect, useRef, useState } from 'react'
import { Loader2, MessageSquare, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { createWorkspaceTabCloseCommands } from '@/components/tab-group/workspace-tab-close-commands'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import NativeChatView from '@/components/native-chat/NativeChatView'
import { PERSONAL_CHATS_WORKSPACE_ID } from '../../../../shared/personal-chats'
import { isAgentSessionHandleProvider } from '../../../../shared/agent-session-provider-handle'
import type { Tab } from '../../../../shared/tab-types'
import { cn } from '@/lib/utils'
import { launchPersonalChat } from './personal-chat-launch'

const EMPTY_TABS: readonly Tab[] = []
const LOCAL_TARGET = { kind: 'local' } as const

export default function PersonalChatsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const tabs = useAppStore(
    (state) => state.unifiedTabsByWorktree[PERSONAL_CHATS_WORKSPACE_ID] ?? EMPTY_TABS
  )
  const groups = useAppStore((state) => state.groupsByWorktree[PERSONAL_CHATS_WORKSPACE_ID])
  const activateTab = useAppStore((state) => state.activateTab)
  const setTabCustomLabel = useAppStore((state) => state.setTabCustomLabel)
  const disabledAgents = useAppStore((state) => state.settings?.disabledTuiAgents)
  const [agent, setAgent] = useState(() => {
    const settings = useAppStore.getState().settings
    return settings?.defaultTuiAgent === 'claude' ? 'claude' : 'codex'
  })
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const chats = tabs.filter((tab) => tab.contentType === 'agent-session')
  const selected =
    chats.find((tab) => tab.entityId === selectedSessionId) ??
    chats.find((tab) => groups?.some((group) => group.activeTabId === tab.id)) ??
    chats.at(-1)

  useEffect(() => {
    let disposed = false
    void window.api.app
      .getPersonalChatDirectory()
      .then((directory) => {
        if (!disposed) {
          useAppStore.setState({ personalChatDirectory: directory })
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      })
    return () => {
      disposed = true
    }
  }, [])

  const createChat = async (): Promise<void> => {
    if (
      creatingRef.current ||
      !isAgentSessionHandleProvider(agent) ||
      disabledAgents?.includes(agent)
    ) {
      return
    }
    creatingRef.current = true
    setCreating(true)
    setError(null)
    try {
      setSelectedSessionId(await launchPersonalChat(agent))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-personal-chats-page>
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium">{t('personalChats.title', 'Personal chats')}</h1>
          <p className="text-xs text-muted-foreground">
            {t('personalChats.local', 'Tools run on this computer')}
          </p>
        </div>
        <Select value={agent} onValueChange={setAgent} disabled={creating}>
          <SelectTrigger className="w-32" aria-label={t('personalChats.agent', 'Agent')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="codex" disabled={disabledAgents?.includes('codex')}>
              Codex
            </SelectItem>
            <SelectItem value="claude" disabled={disabledAgents?.includes('claude')}>
              Claude
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => void createChat()}
          disabled={
            creating || (isAgentSessionHandleProvider(agent) && disabledAgents?.includes(agent))
          }
        >
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus />}
          {creating
            ? t('personalChats.opening', 'Opening chat…')
            : t('personalChats.new', 'New chat')}
        </Button>
      </div>
      {selected ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Input
            key={selected.id}
            aria-label={t('personalChats.name', 'Chat name')}
            defaultValue={selected.customLabel || selected.label}
            className="h-8 max-w-sm text-sm"
            onBlur={(event) =>
              setTabCustomLabel(selected.id, event.currentTarget.value.trim() || null, {
                recordInteraction: false
              })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur()
              }
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('personalChats.close', 'Close chat')}
                onClick={() =>
                  createWorkspaceTabCloseCommands({
                    worktreeId: PERSONAL_CHATS_WORKSPACE_ID,
                    groupTabs: chats
                  }).closeItem(selected.id)
                }
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('personalChats.close', 'Close chat')}</TooltipContent>
          </Tooltip>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1">
        {chats.length > 0 ? (
          <nav
            aria-label={t('personalChats.history', 'Chat history')}
            className="w-52 shrink-0 overflow-y-auto border-r border-border p-2 scrollbar-sleek"
          >
            {chats.toReversed().map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                className={cn(
                  'mb-1 w-full justify-start text-[13px] font-normal',
                  selected?.id === tab.id && 'bg-accent'
                )}
                data-current={selected?.id === tab.id || undefined}
                aria-current={selected?.id === tab.id ? 'page' : undefined}
                onClick={() => {
                  setSelectedSessionId(tab.entityId)
                  activateTab(tab.id, { worktreeId: PERSONAL_CHATS_WORKSPACE_ID })
                }}
              >
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate">
                  {tab.customLabel || tab.generatedLabel || tab.label}
                </span>
              </Button>
            ))}
          </nav>
        ) : null}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {selected && isAgentSessionHandleProvider(selected.agentSessionAgent) ? (
            <NativeChatView
              key={selected.entityId}
              mode="structured"
              tabId={selected.id}
              groupId={selected.groupId}
              sessionId={selected.entityId}
              agent={selected.agentSessionAgent}
              target={LOCAL_TARGET}
              isVisible
              isFocusedGroup
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <MessageSquare className="size-7 text-muted-foreground" />
              <p className="text-sm">{t('personalChats.empty', 'What would you like to do?')}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t(
                  'personalChats.description',
                  'Ask a question or make a quick change to files on this computer. No project needed.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
