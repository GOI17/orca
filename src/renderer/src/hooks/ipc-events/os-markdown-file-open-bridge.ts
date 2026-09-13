import { toast } from 'sonner'
import type { MarkdownDocument } from '../../../../shared/filesystem-entry-types'
import { openLocalFileInWorkspace } from '@/lib/local-file-workspace'
import { translate } from '@/i18n/i18n'

/**
 * Opens markdown files the OS shell handed to Orca ("Open With" / double-click) in their local workspace.
 */
async function openOsRequestedMarkdownFiles(documents: MarkdownDocument[]): Promise<void> {
  // Why the shape check: this payload crosses the preload boundary, so a stale or mismatched
  // preload can hand back something that is not an array. Reading .length off that throws
  // inside the promise chain rather than failing loudly at the boundary.
  if (!Array.isArray(documents) || documents.length === 0) {
    return
  }
  for (const document of documents) {
    // Why isolated: selecting several files hands us one batch, and one unopenable file
    // must not cost the user the rest of the selection.
    try {
      await openLocalFileInWorkspace(document.filePath)
    } catch (error) {
      reportOsRequestedMarkdownFailure(error)
    }
  }
}

function reportOsRequestedMarkdownFailure(error: unknown): void {
  console.error('Failed to open markdown files requested by the OS:', error)
  toast.error(
    translate(
      'auto.hooks.ipc.events.os.markdown.file.open.bridge.1e9a1a63c4',
      'Failed to open the Markdown file.'
    )
  )
}

export function registerOsMarkdownFileOpenBridge(unsubs: (() => void)[]): void {
  const unsubscribe = window.api.ui.onOpenMarkdownFiles?.((documents) => {
    void openOsRequestedMarkdownFiles(documents).catch(reportOsRequestedMarkdownFailure)
  })
  if (unsubscribe) {
    unsubs.push(unsubscribe)
  }

  // Why: a cold-start "Open With" resolves before this listener attaches; drain what main queued.
  const pending = window.api.ui.consumePendingMarkdownFileOpens?.()
  if (pending && typeof pending.then === 'function') {
    void pending.then(openOsRequestedMarkdownFiles).catch(reportOsRequestedMarkdownFailure)
  }
}
