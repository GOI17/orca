import { describe, expect, it } from 'vitest'
import { getEditorCmdSaveFileId } from './editor-cmd-save-target'

describe('getEditorCmdSaveFileId', () => {
  it('claims nothing on a non-workspace view so the shortcut is not swallowed', () => {
    for (const activeView of ['tasks', 'settings', 'activity'] as const) {
      expect(
        getEditorCmdSaveFileId({
          activeFileId: 'main-file',
          activeTabType: 'editor',
          activeView
        })
      ).toBeNull()
    }
  })
})
