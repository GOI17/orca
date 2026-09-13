import { ArrowLeft, Maximize2, Minimize2, PanelBottom, PanelRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { toggleBottomTerminal } from './toggle-bottom-terminal'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import {
  isPairedWebClientWindow,
  shouldRenderDesktopWindowChrome
} from '@/lib/desktop-window-chrome'
import { getRendererAppPlatform } from '@/lib/renderer-app-platform'
import { useSidebarSurfaceDock } from './sidebar-surface-dock'

export function RightSidebarSurfaceToolbar({
  title,
  onHome,
  compact = false
}: {
  title?: string
  onHome?: () => void
  compact?: boolean
}) {
  const rightOpen = useAppStore((state) => state.rightSidebarOpen)
  const toggleRightSidebar = useAppStore((state) => state.toggleRightSidebar)
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const terminalRequested = useSidebarSurfaceDock((state) => state.terminalOpen)
  const terminalGroupId = useSidebarSurfaceDock((state) =>
    worktreeId ? state.terminalGroupByWorktree[worktreeId] : undefined
  )
  const terminalOpen = useAppStore((state) =>
    Boolean(
      terminalRequested &&
      worktreeId &&
      state.groupsByWorktree[worktreeId]?.some((group) => group.id === terminalGroupId)
    )
  )
  const terminalPending = useSidebarSurfaceDock((state) => state.terminalPending)
  const expanded = useSidebarSurfaceDock((state) => state.expanded)
  const toggleExpanded = useSidebarSurfaceDock((state) => state.toggleExpanded)
  const reserveWindowControls =
    !compact &&
    shouldRenderDesktopWindowChrome({
      platform: getRendererAppPlatform(),
      isWebClient: isPairedWebClientWindow()
    })
  const controls = [
    {
      label: expanded
        ? translate('sidebar.surfaces.restore', 'Restore panel size')
        : translate('sidebar.surfaces.expand', 'Expand panel'),
      Icon: expanded ? Minimize2 : Maximize2,
      onClick: toggleExpanded,
      hidden: !rightOpen
    },
    {
      label: translate('sidebar.surfaces.toggleTerminal', 'Toggle terminal'),
      Icon: PanelBottom,
      onClick: () => {
        void toggleBottomTerminal().catch((error) => toast.error(String(error)))
      },
      active: terminalOpen,
      disabled: !worktreeId || terminalPending
    },
    {
      label: translate('auto.App.9e0b441a91', 'Toggle right sidebar'),
      Icon: PanelRight,
      onClick: toggleRightSidebar,
      active: rightOpen
    }
  ]
  return (
    <header
      className={`right-sidebar-header-drag flex min-h-9 shrink-0 items-center gap-1 px-2 ${reserveWindowControls ? 'min-h-18 pt-9' : !compact ? 'right-sidebar-header-inset' : ''}`}
    >
      {title && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="right-sidebar-header-no-drag"
                aria-label={translate('sidebar.surfaces.open', 'Open a surface')}
                onClick={onHome}
              >
                <ArrowLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate('sidebar.surfaces.open', 'Open a surface')}</TooltipContent>
          </Tooltip>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{title}</span>
        </>
      )}
      <div className="right-sidebar-header-no-drag ml-auto flex shrink-0 items-center gap-1">
        {controls
          .filter((control) => !control.hidden)
          .map(({ label, Icon, onClick, active, disabled }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={label}
                  aria-pressed={active}
                  disabled={disabled}
                  className={active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}
                  onClick={onClick}
                >
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
      </div>
    </header>
  )
}
