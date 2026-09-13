import { toWebTerminalSurfaceTabId } from '../../src/shared/terminal-surface-id'
import type { RuntimeTerminalRead } from '../../src/shared/runtime-types'
import { expect, test } from './helpers/orca-app'
import {
  callPairedRuntime,
  waitForPairedClientWorktree
} from './helpers/paired-client-host-session'
import { revealPairedClientWindow } from './helpers/paired-client-window-reveal'
import {
  createRuntimeDesktopPairingOffer,
  launchPairedElectronClient
} from './helpers/paired-electron-client'
import {
  focusActiveTerminalInput,
  readPaneIdentitySnapshot,
  waitForActivePanePtyId,
  waitForPaneIdentitySnapshot
} from './helpers/terminal'

type HostTerminalSurface = {
  type: 'terminal'
  parentTabId: string
  leafId: string
  terminal: string
  parentLayout?: { activeLeafId?: string | null }
}

const splitRightChord = process.platform === 'darwin' ? 'Meta+d' : 'Control+Shift+d'

test('focuses the pane a client split creates on a paired remote workspace @headful', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(150_000)
  const hostWorktreeId = await orcaPage.evaluate(() => window.__store?.getState().activeWorktreeId)
  if (!hostWorktreeId) {
    throw new Error('Headed host has no active seeded workspace')
  }
  const offer = await createRuntimeDesktopPairingOffer(orcaPage)
  const client = await launchPairedElectronClient(offer, testInfo, 'paired-split-focus-client')
  try {
    await revealPairedClientWindow(client)
    await waitForPairedClientWorktree(client.page, hostWorktreeId)

    const created = await callPairedRuntime<{ tab: { parentTabId: string } }>(
      client.page,
      client.environmentId,
      'session.tabs.createTerminal',
      {
        worktree: `id:${hostWorktreeId}`,
        activate: false,
        select: false,
        navigation: 'caller'
      }
    )

    const webTabId = toWebTerminalSurfaceTabId(created.tab.parentTabId)
    await client.page.evaluate(
      (id) => window.__store?.getState().setActiveWorktree(id),
      hostWorktreeId
    )
    const tab = client.page.locator(`[data-testid="sortable-tab"][data-tab-id="${webTabId}"]`)
    await expect(tab).toBeVisible({ timeout: 30_000 })
    await tab.click()
    await expect(tab).toHaveAttribute('data-active', 'true')

    const sourcePtyId = await waitForActivePanePtyId(client.page, 30_000)
    const before = await waitForPaneIdentitySnapshot(client.page, 1)
    const sourceLeafId = before.activeLeafId
    if (!sourceLeafId) {
      throw new Error('Paired source pane has no stable leaf identity')
    }

    await focusActiveTerminalInput(client.page)
    await client.page.keyboard.press(splitRightChord)

    let after = await waitForPaneIdentitySnapshot(client.page, 2)
    let createdPane = after.panes.find((pane) => pane.leafId !== sourceLeafId)
    await expect
      .poll(
        async () => {
          const current = await readPaneIdentitySnapshot(client.page)
          const created = current?.panes.find((pane) => pane.leafId !== sourceLeafId)
          const domLeafId = await client.page.evaluate(
            () => document.activeElement?.closest<HTMLElement>('.pane')?.dataset.leafId ?? null
          )
          if (!current || current.panes.length !== 2 || !created) {
            return false
          }
          after = current
          createdPane = created
          return (
            current.activeLeafId === created.leafId &&
            current.storeActiveLeafId === created.leafId &&
            domLeafId === created.leafId
          )
        },
        { timeout: 30_000, message: 'Host-created split leaf never claimed client focus' }
      )
      .toBe(true)
    if (!createdPane) {
      throw new Error('Paired split did not materialize a new pane')
    }
    const createdLeafId = createdPane.leafId
    const focusedPtyId = await waitForActivePanePtyId(client.page, 30_000)
    expect(focusedPtyId).toBe(createdPane.ptyId)
    expect(focusedPtyId).not.toBe(sourcePtyId)

    const focusedDomLeafId = await client.page.evaluate(
      () => document.activeElement?.closest<HTMLElement>('.pane')?.dataset.leafId ?? null
    )
    expect(focusedDomLeafId).toBe(createdPane.leafId)

    const marker = `STA_5518_FOCUSED_${Date.now()}`
    await client.page.keyboard.type(`printf '%s\\n' ${JSON.stringify(marker)}`)
    await client.page.keyboard.press('Enter')

    await expect
      .poll(
        () =>
          client.page.evaluate((tabId) => {
            const manager = window.__paneManagers?.get(tabId)
            return Object.fromEntries(
              (manager?.getPanes() ?? []).map((pane) => [
                pane.leafId,
                pane.serializeAddon?.serialize?.() ?? ''
              ])
            )
          }, webTabId),
        { timeout: 30_000, message: 'Immediate post-split marker never reached the visible pane' }
      )
      .toMatchObject({ [createdLeafId]: expect.stringContaining(marker) })

    const hostTabs = await callPairedRuntime<{ tabs: HostTerminalSurface[] }>(
      client.page,
      client.environmentId,
      'session.tabs.list',
      { worktree: `id:${hostWorktreeId}` }
    )
    const hostLeaves = hostTabs.tabs.filter(
      (surface) => surface.type === 'terminal' && surface.parentTabId === created.tab.parentTabId
    )
    expect(hostLeaves.map((surface) => surface.leafId).sort()).toEqual(
      after.panes.map((pane) => pane.leafId).sort()
    )
    expect(hostLeaves[0]?.parentLayout?.activeLeafId).toBe(createdPane.leafId)

    const surfaceByLeafId = new Map(hostLeaves.map((surface) => [surface.leafId, surface]))
    await expect
      .poll(
        async () => {
          const reads = await Promise.all(
            [sourceLeafId, createdLeafId].map(async (leafId) => {
              const surface = surfaceByLeafId.get(leafId)
              if (!surface) {
                return false
              }
              const result = await callPairedRuntime<{ terminal: RuntimeTerminalRead }>(
                client.page,
                client.environmentId,
                'terminal.read',
                { terminal: surface.terminal }
              )
              return result.terminal.tail.join('\n').includes(marker)
            })
          )
          return reads
        },
        { timeout: 30_000, message: 'Host PTY output did not identify one marker destination' }
      )
      .toEqual([false, true])

    await client.page.locator(`.pane[data-leaf-id="${createdLeafId}"]`).click({ button: 'right' })
    await client.page.getByRole('menuitem', { name: /Split Terminal Right/i }).click()
    let afterMenuSplit = await waitForPaneIdentitySnapshot(client.page, 3)
    const priorLeafIds = new Set(after.panes.map((pane) => pane.leafId))
    let menuCreatedPane = afterMenuSplit.panes.find((pane) => !priorLeafIds.has(pane.leafId))
    await expect
      .poll(
        async () => {
          const current = await readPaneIdentitySnapshot(client.page)
          const created = current?.panes.find((pane) => !priorLeafIds.has(pane.leafId))
          const domLeafId = await client.page.evaluate(
            () => document.activeElement?.closest<HTMLElement>('.pane')?.dataset.leafId ?? null
          )
          if (!current || current.panes.length !== 3 || !created) {
            return false
          }
          afterMenuSplit = current
          menuCreatedPane = created
          return (
            current.activeLeafId === created.leafId &&
            current.storeActiveLeafId === created.leafId &&
            domLeafId === created.leafId
          )
        },
        { timeout: 30_000, message: 'Menu-created split leaf never claimed client focus' }
      )
      .toBe(true)
    if (!menuCreatedPane) {
      throw new Error('Menu split did not materialize a new pane')
    }
    const menuCreatedLeafId = menuCreatedPane.leafId
    const menuMarker = `STA_5518_MENU_FOCUSED_${Date.now()}`
    await client.page.keyboard.type(`printf '%s\\n' ${JSON.stringify(menuMarker)}`)
    await client.page.keyboard.press('Enter')

    await expect
      .poll(
        () =>
          client.page.evaluate((tabId) => {
            const manager = window.__paneManagers?.get(tabId)
            return Object.fromEntries(
              (manager?.getPanes() ?? []).map((pane) => [
                pane.leafId,
                pane.serializeAddon?.serialize?.() ?? ''
              ])
            )
          }, webTabId),
        { timeout: 30_000, message: 'Menu split marker never reached the focused pane' }
      )
      .toMatchObject({ [menuCreatedLeafId]: expect.stringContaining(menuMarker) })

    const afterMenuHostTabs = await callPairedRuntime<{ tabs: HostTerminalSurface[] }>(
      client.page,
      client.environmentId,
      'session.tabs.list',
      { worktree: `id:${hostWorktreeId}` }
    )
    const afterMenuHostLeaves = afterMenuHostTabs.tabs.filter(
      (surface) => surface.type === 'terminal' && surface.parentTabId === created.tab.parentTabId
    )
    expect(afterMenuHostLeaves.map((surface) => surface.leafId).sort()).toEqual(
      afterMenuSplit.panes.map((pane) => pane.leafId).sort()
    )
    expect(afterMenuHostLeaves[0]?.parentLayout?.activeLeafId).toBe(menuCreatedPane.leafId)
    const menuSurfaceByLeafId = new Map(
      afterMenuHostLeaves.map((surface) => [surface.leafId, surface])
    )
    await expect
      .poll(
        async () => {
          const reads = await Promise.all(
            afterMenuSplit.panes.map(async ({ leafId }) => {
              const surface = menuSurfaceByLeafId.get(leafId)
              if (!surface) {
                return false
              }
              const result = await callPairedRuntime<{ terminal: RuntimeTerminalRead }>(
                client.page,
                client.environmentId,
                'terminal.read',
                { terminal: surface.terminal }
              )
              return result.terminal.tail.join('\n').includes(menuMarker)
            })
          )
          return reads
        },
        { timeout: 30_000, message: 'Menu marker did not reach exactly its created host PTY' }
      )
      .toEqual(afterMenuSplit.panes.map(({ leafId }) => leafId === menuCreatedLeafId))

    await testInfo.attach('paired-cmd-d-focused-pane', {
      body: await client.page.screenshot(),
      contentType: 'image/png'
    })
  } finally {
    await client.dispose()
  }
})
