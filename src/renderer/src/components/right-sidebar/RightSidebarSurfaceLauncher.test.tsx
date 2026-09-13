// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TerminalSquare } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RightSidebarSurfaceLauncher,
  type SidebarSurfaceAction
} from './RightSidebarSurfaceLauncher'

let root: Root | undefined
afterEach(async () => {
  await act(async () => root?.unmount())
  document.body.innerHTML = ''
})

async function mount(actions: SidebarSurfaceAction[]) {
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<RightSidebarSurfaceLauncher actions={actions} />))
  return container
}

describe('surface launcher interaction', () => {
  it('handles letter shortcuts only inside the launcher, without consuming modifier chords', async () => {
    const onOpen = vi.fn()
    const container = await mount([
      { id: 'terminal', title: 'Terminal', icon: TerminalSquare, key: 'T', onOpen }
    ])
    const button = container.querySelector('button')!
    await act(async () =>
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
    )
    await act(async () =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true }))
    )
    await act(async () =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true, bubbles: true }))
    )
    expect(onOpen).not.toHaveBeenCalled()
    await act(async () =>
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
    )
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not launch unavailable surfaces from the keyboard', async () => {
    const onOpen = vi.fn()
    const container = await mount([
      { id: 'terminal', title: 'Terminal', icon: TerminalSquare, key: 'T', disabled: true, onOpen }
    ])
    await act(async () =>
      container
        .querySelector('section')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
    )
    expect(container.querySelector('button')!.disabled).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('prevents duplicate remote launches and enables retry after completion', async () => {
    let complete!: () => void
    const onOpen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve
        })
    )
    const container = await mount([
      { id: 'terminal', title: 'Terminal', icon: TerminalSquare, key: 'T', onOpen }
    ])
    const section = container.querySelector('section')!
    await act(async () => {
      section.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
      section.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true }))
    })
    expect(onOpen).toHaveBeenCalledOnce()
    expect(container.querySelector('button')!.disabled).toBe(true)
    await act(async () => complete())
    expect(container.querySelector('button')!.disabled).toBe(false)
  })
})
