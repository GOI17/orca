import { useRef, useState } from 'react'
import { translate } from '@/i18n/i18n'

export function SidebarDockResizeHandle({
  bottom,
  size,
  maxSize,
  onResize
}: {
  bottom: boolean
  size: number
  maxSize: number
  onResize: (size: number) => void
}) {
  const drag = useRef<{ pointerId: number; coordinate: number; size: number; next: number } | null>(
    null
  )
  const [dragging, setDragging] = useState(false)
  const minSize = bottom ? 160 : 220
  const clamp = (value: number) => Math.max(minSize, Math.min(maxSize, value))
  return (
    <>
      {dragging && (
        <div
          className={`fixed inset-0 z-50 ${bottom ? 'cursor-row-resize' : 'cursor-col-resize'}`}
        />
      )}
      <div
        role="separator"
        tabIndex={0}
        aria-label={translate('sidebar.surfaces.resize', 'Resize surface panel')}
        aria-orientation={bottom ? 'horizontal' : 'vertical'}
        aria-valuenow={Math.round(size)}
        aria-valuemin={minSize}
        aria-valuemax={Math.round(maxSize)}
        className={`absolute z-50 touch-none hover:bg-ring/20 focus-visible:bg-ring/20 focus-visible:outline-none ${bottom ? 'inset-x-0 top-0 h-1 cursor-row-resize' : 'inset-y-0 left-0 w-1 cursor-col-resize'}`}
        onKeyDown={(event) => {
          const delta =
            event.key === (bottom ? 'ArrowUp' : 'ArrowLeft')
              ? 20
              : event.key === (bottom ? 'ArrowDown' : 'ArrowRight')
                ? -20
                : 0
          if (!delta) {
            return
          }
          event.preventDefault()
          onResize(clamp(size + delta))
        }}
        onPointerDown={(event) => {
          if (drag.current || event.button !== 0) {
            return
          }
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = {
            pointerId: event.pointerId,
            coordinate: bottom ? event.clientY : event.clientX,
            size,
            next: size
          }
          setDragging(true)
        }}
        onPointerMove={(event) => {
          const current = drag.current
          if (!current || event.pointerId !== current.pointerId) {
            return
          }
          current.next = clamp(
            current.size + current.coordinate - (bottom ? event.clientY : event.clientX)
          )
          const panel = event.currentTarget.parentElement
          // Commit once on release; live layout updates should not publish the whole app store per pixel.
          if (panel) {
            panel.style[bottom ? 'height' : 'width'] = `${current.next}px`
          }
        }}
        onLostPointerCapture={() => {
          if (!drag.current) {
            return
          }
          onResize(drag.current.next)
          drag.current = null
          setDragging(false)
        }}
      />
    </>
  )
}
