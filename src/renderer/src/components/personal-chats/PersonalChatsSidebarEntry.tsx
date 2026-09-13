import { isWebClientLocation } from '@/lib/web-client-location'
import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PersonalChatsSidebarEntry(): React.JSX.Element | null {
  const { t } = useTranslation()
  const active = useAppStore((state) => state.activeView === 'personal-chats')
  const setActiveView = useAppStore((state) => state.setActiveView)
  if (isWebClientLocation()) {
    return null
  }
  return (
    <Button
      variant="ghost"
      onClick={() => setActiveView('personal-chats')}
      aria-current={active ? 'page' : undefined}
      data-current={active || undefined}
      className={cn(
        'h-auto w-full justify-start gap-2 px-2 py-1.5 text-[13px]',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-accent'
      )}
    >
      <MessageSquare className="size-4 shrink-0" />
      {t('personalChats.title', 'Personal chats')}
    </Button>
  )
}
