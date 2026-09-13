import { createServer } from 'node:http'
import { test, expect } from './helpers/orca-app'
import { waitForActiveTerminalManager, waitForTerminalOutput } from './helpers/terminal'

test('surface panel keeps its terminal and browser alive while docking', async ({
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
  await panel.getByRole('button', { name: 'Dock panel at bottom' }).click()
  await expect(panel).toHaveAttribute('data-dock-position', 'bottom')
  await expect.poll(contained).toBe(true)
  await expect(terminal).toHaveAttribute('data-terminal-overlay-tab-id', identity!)
  await waitForTerminalOutput(orcaPage, 'ORCA_DOCK_SESSION_ALIVE')
  await orcaPage.screenshot({ path: testInfo.outputPath('sidebar-terminal-bottom.png') })
  await panel.getByRole('button', { name: 'Dock panel at right' }).click()
  await expect.poll(contained).toBe(true)
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
    await panel.getByRole('button', { name: 'Dock panel at bottom' }).click()
    await expect.poll(readGuest).toBe('edited without reloading')
    await panel.getByRole('button', { name: 'Close panel' }).click()
    await expect(browser).toBeHidden()
    await orcaPage.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click()
    await expect(browser).toBeVisible()
    await expect.poll(readGuest).toBe('edited without reloading')
    const browserBox = await browser.boundingBox()
    const panelBox = await panel.boundingBox()
    expect(browserBox!.y).toBeGreaterThan(panelBox!.y)
    await orcaPage.screenshot({ path: testInfo.outputPath('sidebar-browser-bottom.png') })
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
