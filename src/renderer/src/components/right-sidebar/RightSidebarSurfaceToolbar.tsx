import { ArrowLeft, Maximize2, Minimize2, PanelBottom, PanelRight, X } from 'lucide-react'
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
  onClose
}: {
  title?: string
  onHome: () => void
  onClose: () => void
}) {
  const position = useSidebarSurfaceDock((state) => state.position)
  const expanded = useSidebarSurfaceDock((state) => state.expanded)
  const setPosition = useSidebarSurfaceDock((state) => state.setPosition)
  const toggleExpanded = useSidebarSurfaceDock((state) => state.toggleExpanded)
  const reserveWindowControls =
    position === 'right' &&
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
      onClick: toggleExpanded
    },
    {
      label: translate('sidebar.surfaces.dockBottom', 'Dock panel at bottom'),
      Icon: PanelBottom,
      onClick: () => setPosition('bottom'),
      active: position === 'bottom'
    },
    {
      label: translate('sidebar.surfaces.dockRight', 'Dock panel at right'),
      Icon: PanelRight,
      onClick: () => setPosition('right'),
      active: position === 'right'
    }
  ]
  return (
    <header
      className={`right-sidebar-header-drag flex min-h-9 shrink-0 items-center gap-1 px-2 ${reserveWindowControls ? 'min-h-18 pt-9' : position === 'right' ? 'right-sidebar-header-inset' : ''}`}
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
        {controls.map(({ label, Icon, onClick, active }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={label}
                aria-pressed={active}
                className={active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}
                onClick={onClick}
              >
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={translate('sidebar.surfaces.close', 'Close panel')}
              onClick={onClose}
            >
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{translate('sidebar.surfaces.close', 'Close panel')}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
