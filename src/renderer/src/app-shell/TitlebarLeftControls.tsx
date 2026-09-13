import { MoreHorizontal, PanelLeft } from 'lucide-react'
import logo from '../../../../resources/logo.svg'
import { translate } from '@/i18n/i18n'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useShortcutLabel } from '../hooks/useShortcutLabel'
import { useAppStore } from '../store'
import { hasCustomTitleBar, isMac } from './app-window-chrome'
import type { AppChromeLayout } from './use-app-chrome-layout'

/** Window chrome, app name, and sidebar toggle. */
export function TitlebarLeftControls({ layout }: { layout: AppChromeLayout }): React.JSX.Element {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const leftSidebarShortcutLabel = useShortcutLabel('sidebar.left.toggle')

  return (
    // Reserve the full control width beside the workspace toolbar when the sidebar is collapsed.
    // Why: collapsed mode floats in a w-0 wrapper; w-max stops Windows Chromium from shrinking the app name to one glyph.
    <div
      ref={layout.titlebarLeftControlsRef}
      className={`flex h-full shrink-0 items-center${
        layout.leftTitlebarChromeLayout.isFloating ? ' w-max' : ' w-full'
      }`}
    >
      <div className="flex h-full items-center">
        {isMac && !layout.isFullScreen ? (
          <div className="titlebar-traffic-light-pad" />
        ) : hasCustomTitleBar ? (
          /* Why: Windows/Linux remove the native title bar, so render the logo plus a ··· button that pops the application menu (as Alt does). */
          <>
            <img src={logo} alt="" aria-hidden className="titlebar-logo" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="titlebar-icon-button"
                  aria-label={translate('auto.App.8b0b8eb54f', 'Application menu')}
                  onClick={() => window.api.ui.popupMenu()}
                >
                  <MoreHorizontal size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {translate('auto.App.8b0b8eb54f', 'Application menu')}
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <div className="pl-2" />
        )}
        {layout.showSidebar && !hasCustomTitleBar && layout.showTitlebarAppName && (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div
                className="titlebar-app-name"
                aria-label={translate('auto.App.5096cbbc86', 'Orca')}
              >
                <span className="titlebar-app-name-main">
                  {translate('auto.App.5096cbbc86', 'Orca')}
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem
                onSelect={() => {
                  void updateSettings({ showTitlebarAppName: false })
                }}
              >
                {translate('auto.App.e81217c1b7', 'Hide App Name')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
        {layout.showSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="sidebar-toggle"
                onClick={toggleSidebar}
                aria-label={translate('auto.App.e4b9e7dff7', 'Toggle sidebar')}
              >
                <PanelLeft size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {translate('auto.App.ce37cf5279', 'Toggle sidebar ({{value0}})', {
                value0: leftSidebarShortcutLabel
              })}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
