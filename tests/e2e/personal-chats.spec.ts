import { writeFile } from 'node:fs/promises'
import { test, expect } from './helpers/orca-app'

test.use({ seedTestRepo: false })

test('opens personal chats without a project and keeps execution local', async ({
  orcaPage: page,
  electronApp
}, testInfo) => {
  await page.getByRole('button', { name: 'Personal chats', exact: true }).click()
  await expect(page.locator('[data-personal-chats-page]')).toBeVisible()
  await expect(page.getByText('Tools run on this computer')).toBeVisible()
  expect(await page.evaluate(() => window.__store?.getState().repos.length)).toBe(0)
  expect(
    await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some((window) => window.isVisible())
    )
  ).toBe(false)

  const cdp = await page.context().newCDPSession(page)
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  })
  await writeFile(
    testInfo.outputPath('personal-chats-empty.png'),
    Buffer.from(screenshot.data, 'base64')
  )
  await cdp.detach()

  const directory = await page.evaluate(() => window.api.app.getPersonalChatDirectory())
  expect(directory).toContain('personal-chats')
  const support = await page.evaluate(() =>
    window.api.runtime.call({
      method: 'agentSession.createSupport',
      params: { worktree: 'id:personal-chats', agent: 'codex' }
    })
  )
  // Before first use, the personal-chat engine remains disabled.
  expect(support.ok).toBe(false)
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Chat name' })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-personal-chats-page]')).toBeVisible()
  expect(
    await page.evaluate(() => ({
      repos: window.__store?.getState().repos.length,
      enabled: window.__store?.getState().settings?.personalChatsEnabled,
      activeWorktree: window.__store?.getState().activeWorktreeId
    }))
  ).toEqual({ repos: 0, enabled: true, activeWorktree: null })
  await expect(page.getByRole('textbox', { name: 'Send a message…', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Chat name' }).fill('Karabiner shortcuts')
  await page.getByRole('textbox', { name: 'Chat name' }).press('Enter')
  await expect(
    page.getByRole('navigation', { name: 'Chat history' }).getByText('Karabiner shortcuts')
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Send a message…', exact: true })
    .fill('Review my keyboard shortcuts')
  await page.getByRole('button', { name: 'New chat', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Chat name' })).toHaveValue('Codex Chat')
  await page
    .getByRole('navigation', { name: 'Chat history' })
    .getByText('Karabiner shortcuts')
    .click()
  await expect(page.getByRole('textbox', { name: 'Send a message…', exact: true })).toHaveText(
    'Review my keyboard shortcuts'
  )
  await page.evaluate(async () => {
    await window.__store?.getState().updateSettingsOrThrow({ theme: 'dark' })
  })
  const chatCdp = await page.context().newCDPSession(page)
  const chatScreenshot = await chatCdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  })
  await writeFile(
    testInfo.outputPath('personal-chats-conversation.png'),
    Buffer.from(chatScreenshot.data, 'base64')
  )
  await chatCdp.detach()
  await page.reload()
  await expect(
    page.getByRole('navigation', { name: 'Chat history' }).getByText('Karabiner shortcuts')
  ).toBeVisible({ timeout: 30_000 })
  await page.evaluate(async () => {
    await window.__store?.getState().updateSettingsOrThrow({ uiLanguage: 'es' })
  })
  await expect(page.getByRole('heading', { name: 'Chats personales', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar chat', exact: true }).click()
  await expect(
    page.getByRole('navigation', { name: 'Historial de chats' }).getByText('Karabiner shortcuts')
  ).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chats personales', exact: true })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Historial de chats' }).getByText('Karabiner shortcuts')
  ).toHaveCount(0)
})
