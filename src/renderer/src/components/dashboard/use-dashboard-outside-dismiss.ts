import { useEffect } from 'react'
import type React from 'react'

const DASHBOARD_KEEP_OPEN_SELECTOR = [
  '[data-workspace-status-appearance-popover]',
  '[data-contextual-tour-overlay]',
  '[data-contextual-tour-panel]',
  '[data-radix-popper-content-wrapper]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="context-menu-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="dialog-content"]',
  '[data-slot="dialog-overlay"]',
  '[data-sonner-toast]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="menu"][data-state="open"]'
].join(', ')

export function isDashboardKeepOpenTarget(target: EventTarget | null): boolean {
  const element =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null
  // Dashboard menus portal outside the sheet and must not dismiss their owner.
  return Boolean(element?.closest(DASHBOARD_KEEP_OPEN_SELECTOR))
}

export function useDashboardOutsideDismiss(params: {
  open: boolean
  contentRef: React.RefObject<HTMLDivElement | null>
  preserveOpenForMenu: boolean
  onOpenChange: (open: boolean) => void
}): void {
  const { open, contentRef, preserveOpenForMenu, onOpenChange } = params

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const content = contentRef.current?.closest<HTMLElement>('[data-slot="sheet-content"]')
      if (!content || preserveOpenForMenu) {
        return
      }
      if (event.target instanceof Node && content.contains(event.target)) {
        return
      }
      if (isDashboardKeepOpenTarget(event.target)) {
        return
      }
      const rect = content.getBoundingClientRect()
      if (event.clientX > rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        onOpenChange(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [contentRef, onOpenChange, open, preserveOpenForMenu])
}
