import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MarkdownDocument } from '../../../../shared/filesystem-entry-types'
import { registerOsMarkdownFileOpenBridge } from './os-markdown-file-open-bridge'

const mocks = vi.hoisted(() => ({ openFile: vi.fn(), toastError: vi.fn() }))
vi.mock('@/lib/local-file-workspace', () => ({ openLocalFileInWorkspace: mocks.openFile }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

const document: MarkdownDocument = {
  filePath: '/notes/README.md',
  relativePath: 'README.md',
  basename: 'README.md',
  name: 'README'
}
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('OS markdown file requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.openFile.mockResolvedValue('file-1')
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('opens queued local files and unsubscribes from subsequent requests', async () => {
    let listener: ((documents: MarkdownDocument[]) => void) | undefined
    const unsubscribe = vi.fn()
    vi.stubGlobal('window', {
      api: {
        ui: {
          onOpenMarkdownFiles: (callback: typeof listener) => {
            listener = callback
            return unsubscribe
          },
          consumePendingMarkdownFileOpens: async () => [document]
        }
      }
    })
    const unsubs: (() => void)[] = []
    registerOsMarkdownFileOpenBridge(unsubs)
    await settle()
    expect(mocks.openFile).toHaveBeenCalledWith(document.filePath)
    listener?.([{ ...document, filePath: '/notes/next.md' }])
    await settle()
    expect(mocks.openFile).toHaveBeenLastCalledWith('/notes/next.md')
    unsubs.forEach((unsub) => unsub())
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('continues a batch after a failed open', async () => {
    mocks.openFile.mockRejectedValueOnce(new Error('unavailable'))
    vi.stubGlobal('window', {
      api: {
        ui: {
          consumePendingMarkdownFileOpens: async () => [
            document,
            { ...document, filePath: '/next.md' }
          ]
        }
      }
    })
    registerOsMarkdownFileOpenBridge([])
    await settle()
    expect(mocks.openFile).toHaveBeenCalledTimes(2)
    expect(mocks.toastError).toHaveBeenCalledOnce()
  })

  it('ignores malformed pending payloads', async () => {
    vi.stubGlobal('window', { api: { ui: { consumePendingMarkdownFileOpens: async () => null } } })
    registerOsMarkdownFileOpenBridge([])
    await settle()
    expect(mocks.openFile).not.toHaveBeenCalled()
  })
})
