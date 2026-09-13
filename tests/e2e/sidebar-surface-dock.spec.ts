import { createServer } from 'node:http'
import { test, expect } from './helpers/orca-app'
import { waitForActiveTerminalManager, waitForTerminalOutput } from './helpers/terminal'

test('panel toggles, expands fully, and keeps the bottom terminal independent', async ({
  orcaPage
}, testInfo) => {
  test.setTimeout(120_000)
  await waitForActiveTerminalManager(orcaPage, 30_000)
  await orcaPage.evaluate(() => {
    const store = window.__store!
    store.getState().setRightSidebarOpen(true)
    store.setState((state) => ({ settings: { ...state.settings, theme: 'dark' } }))
  })
  const panel = orcaPage.locator('[data-sidebar-surface-panel]')
  const quickCommand = orcaPage.getByRole('button', { name: 'Add quick command', exact: true })
  const commandStrip = () =>
    quickCommand.evaluate((button) =>
      button.closest('[data-tab-group-strip-id]')?.getAttribute('data-tab-group-strip-id')
    )
  const mainCommandGroupId = await commandStrip()
  await expect(panel.getByRole('heading', { name: 'Open a surface' })).toBeVisible()
  await orcaPage.screenshot({ path: testInfo.outputPath('sidebar-launcher.png') })
  await panel.getByRole('button', { name: /^Terminal/ }).click()
  await waitForActiveTerminalManager(orcaPage, 30_000)
  const initialTerminal = orcaPage
    .locator('[data-terminal-overlay-tab-id]')
    .filter({ visible: true })
    .last()
  await expect(initialTerminal).toBeVisible()
  const identity = await initialTerminal.getAttribute('data-terminal-overlay-tab-id')
  const terminal = orcaPage.locator(`[data-terminal-overlay-tab-id="${identity}"]`)
  const contained = async () => {
    const surface = await terminal.boundingBox()
    const bounds = await panel.boundingBox()
    return Boolean(
      surface &&
      bounds &&
      surface.x >= bounds.x &&
      surface.y >= bounds.y &&
      surface.x + surface.width <= bounds.x + bounds.width + 1 &&
      surface.y + surface.height <= bounds.y + bounds.height + 1
    )
  }
  await expect.poll(contained).toBe(true)
  const initialPanelWidth = (await panel.boundingBox())!.width
  await panel.getByRole('separator').focus()
  await orcaPage.keyboard.press('ArrowLeft')
  await expect
    .poll(async () => (await panel.boundingBox())!.width)
    .toBeGreaterThan(initialPanelWidth)
  const beforeDragWidth = (await panel.boundingBox())!.width
  const resizeHandle = (await panel.getByRole('separator').boundingBox())!
  const dragX = resizeHandle.x + resizeHandle.width / 2
  const dragY = resizeHandle.y + resizeHandle.height / 2
  await orcaPage.mouse.move(dragX, dragY)
  await orcaPage.mouse.down()
  await orcaPage.mouse.move(dragX - 40, dragY, { steps: 4 })
  await orcaPage.mouse.up()
  await expect
    .poll(async () => (await panel.boundingBox())!.width)
    .toBeGreaterThan(beforeDragWidth + 20)
  await terminal.locator('.xterm-helper-textarea').focus()
  await orcaPage.keyboard.type('echo ORCA_DOCK_SESSION_ALIVE')
  await orcaPage.keyboard.press('Enter')
  await waitForTerminalOutput(orcaPage, 'ORCA_DOCK_SESSION_ALIVE')
  await expect(panel.getByRole('button', { name: 'Close panel', exact: true })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
  const bottom = orcaPage.locator('[data-bottom-terminal-panel]')
  await expect(bottom).toHaveAttribute('aria-hidden', 'false')
  await expect(panel).toHaveAttribute('data-dock-position', 'right')
  await expect.poll(contained).toBe(true)
  const bottomGroupId = await bottom
    .locator('[data-tab-group-body-id]')
    .getAttribute('data-tab-group-body-id')
  const bottomTabId = await orcaPage.evaluate((groupId) => {
    const state = window.__store!.getState()
    return state.unifiedTabsByWorktree[state.activeWorktreeId!]?.find(
      (tab) => tab.groupId === groupId
    )?.id
  }, bottomGroupId)
  const bottomTerminal = orcaPage.locator(`[data-terminal-overlay-tab-id="${bottomTabId}"]`)
  await expect(bottomTerminal).toBeVisible()
  await expect.poll(commandStrip).toBe(mainCommandGroupId)
  await expect(bottom.getByRole('button', { name: 'Add quick command', exact: true })).toHaveCount(
    0
  )
  await quickCommand.click()
  await expect(orcaPage.getByRole('dialog')).toBeVisible()
  await expect
    .poll(() =>
      orcaPage.evaluate(() => {
        const state = window.__store!.getState()
        return state.activeGroupIdByWorktree[state.activeWorktreeId!]
      })
    )
    .toBe(bottomGroupId)
  await orcaPage.keyboard.press('Escape')
  await expect(orcaPage.getByRole('dialog')).toBeHidden()
  await bottomTerminal.locator('.xterm-helper-textarea').focus()
  await orcaPage.keyboard.type('echo ORCA_BOTTOM_SESSION_ALIVE')
  await orcaPage.keyboard.press('Enter')
  await waitForTerminalOutput(orcaPage, 'ORCA_BOTTOM_SESSION_ALIVE')
  await panel.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
  await expect(bottomTerminal).toBeHidden()
  await expect.poll(commandStrip).toBe(mainCommandGroupId)
  await panel.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
  await expect(bottomTerminal).toBeVisible()
  await waitForTerminalOutput(orcaPage, 'ORCA_BOTTOM_SESSION_ALIVE')
  await panel.getByRole('button', { name: 'Expand panel', exact: true }).click()
  const workspace = orcaPage.locator('[data-workspace-content]')
  await expect
    .poll(async () => {
      const expanded = (await panel.boundingBox())!
      const available = (await workspace.boundingBox())!
      return Math.abs(expanded.width - available.width) + Math.abs(expanded.x - available.x)
    })
    .toBeLessThan(2)
  await expect(bottomTerminal).toBeHidden()
  await expect.poll(contained).toBe(true)
  await orcaPage.screenshot({ path: testInfo.outputPath('sidebar-expanded.png') })
  await panel.getByRole('button', { name: 'Restore panel size', exact: true }).click()
  await expect(bottomTerminal).toBeVisible()
  await panel.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click()
  await expect(orcaPage.getByRole('button', { name: 'Expand panel', exact: true })).toHaveCount(0)
  await expect(
    orcaPage.getByRole('button', { name: 'Restore panel size', exact: true })
  ).toHaveCount(0)
  await expect(terminal).toBeHidden()
  await expect(bottomTerminal).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
  await expect(bottomTerminal).toBeHidden()
  await orcaPage.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
  await expect(bottomTerminal).toBeVisible()
  await orcaPage.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Expand panel', exact: true })).toBeVisible()
  await expect(terminal).toBeVisible()
  await panel.getByRole('button', { name: 'Open a surface', exact: true }).click()
  await expect(terminal).toBeHidden()

  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end(
      '<html><title>Dock persistence</title><body><h1>Browser inside panel</h1><input id="retained" value="session survives docking"></body></html>'
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Missing test server port')
    }
    await orcaPage.evaluate(
      (url) => window.__store!.setState({ browserDefaultUrl: url }),
      `http://127.0.0.1:${address.port}`
    )
    await panel.getByRole('button', { name: /^Browser/ }).click()
    const initialBrowser = orcaPage
      .locator('[data-browser-overlay-tab-id]')
      .filter({ visible: true })
      .last()
    await expect(initialBrowser).toBeVisible()
    const browserId = await initialBrowser.getAttribute('data-browser-overlay-tab-id')
    const browser = orcaPage.locator(`[data-browser-overlay-tab-id="${browserId}"]`)
    const guest = browser.locator('webview').first()
    await expect(guest).toBeAttached()
    const readGuest = () =>
      guest.evaluate(async (element) => {
        const view = element as HTMLElement & {
          executeJavaScript: (source: string) => Promise<string>
        }
        return view.executeJavaScript('document.querySelector("#retained")?.value')
      })
    await expect.poll(readGuest).toBe('session survives docking')
    await guest.evaluate(async (element) => {
      const view = element as HTMLElement & {
        executeJavaScript: (source: string) => Promise<unknown>
      }
      await view.executeJavaScript(
        'document.querySelector("#retained").value = "edited without reloading"'
      )
    })
    await panel.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
    await expect(bottomTerminal).toBeHidden()
    await panel.getByRole('button', { name: 'Toggle terminal', exact: true }).click()
    await expect(bottomTerminal).toBeVisible()
    await expect.poll(readGuest).toBe('edited without reloading')
    await panel.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click()
    await expect(browser).toBeHidden()
    await orcaPage.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click()
    await expect(browser).toBeVisible()
    await expect.poll(readGuest).toBe('edited without reloading')
    const browserBox = await browser.boundingBox()
    const panelBox = await panel.boundingBox()
    expect(browserBox!.y).toBeGreaterThan(panelBox!.y)
    await orcaPage.screenshot({ path: testInfo.outputPath('sidebar-browser-and-terminal.png') })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
