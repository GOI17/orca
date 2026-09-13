import React from 'react'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'

const SidebarToolbar = React.memo(function SidebarToolbar() {
  return (
    <div className="mt-auto shrink-0">
      <div className="flex items-center border-t border-worktree-sidebar-border px-2 py-1.5">
        <SidebarSettingsHelpMenu />
      </div>
    </div>
  )
})

export default SidebarToolbar
