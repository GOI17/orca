import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ShortcutKeyCombo } from '@/components/ShortcutKeyCombo'
import { translate } from '@/i18n/i18n'
import type { ActivityBarItem } from './activity-bar-buttons'

export type SidebarSurfaceAction = {
  id: string
  title: string
  icon: ActivityBarItem['icon']
  key?: string
  disabled?: boolean
  onOpen: () => void | Promise<unknown>
}

export function RightSidebarSurfaceLauncher({ actions }: { actions: SidebarSurfaceAction[] }) {
  const pendingRef = useRef<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [showPending, setShowPending] = useState(false)

  useEffect(() => {
    setShowPending(false)
    if (!pending) {
      return
    }
    const timer = setTimeout(() => setShowPending(true), 200)
    return () => clearTimeout(timer)
  }, [pending])

  const openSurface = async (action: SidebarSurfaceAction) => {
    if (action.disabled || pendingRef.current) {
      return
    }
    // Remote creation can outlive a click; keep repeat keys from opening duplicate surfaces.
    pendingRef.current = action.id
    setPending(action.id)
    try {
      await action.onOpen()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      pendingRef.current = null
      setPending(null)
    }
  }

  return (
    <section
      aria-label={translate('sidebar.surfaces.open', 'Open a surface')}
      className="scrollbar-sleek flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-12"
      onKeyDown={(event) => {
        // Letter shortcuts belong to this launcher, never to a focused terminal or editor.
        if (
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing ||
          event.repeat
        ) {
          return
        }
        if ((event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) {
          return
        }
        const action = actions.find((item) => item.key?.toLowerCase() === event.key.toLowerCase())
        if (!action || action.disabled) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        void openSurface(action)
      }}
    >
      <div className="mx-auto my-auto w-full max-w-80 py-6">
        <h2 className="mb-4 text-center text-sm font-medium text-foreground">
          {translate('sidebar.surfaces.open', 'Open a surface')}
        </h2>
        <div className="flex flex-col gap-1">
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.id}
                variant="ghost"
                className="h-9 w-full justify-start gap-3 px-2 text-[13px] font-normal disabled:opacity-40"
                disabled={action.disabled || pending !== null}
                aria-label={action.title}
                aria-keyshortcuts={action.key}
                aria-busy={pending === action.id}
                onClick={() => void openSurface(action)}
              >
                {pending === action.id && showPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                <span className="min-w-0 flex-1 truncate text-left">{action.title}</span>
                {action.key && (
                  <ShortcutKeyCombo
                    keys={[action.key]}
                    keyCapClassName="border-transparent bg-muted px-1 py-0 text-[11px] shadow-none"
                  />
                )}
              </Button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
