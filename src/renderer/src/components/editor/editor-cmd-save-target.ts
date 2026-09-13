import type { TopLevelView } from '../../../../shared/ui-chrome-types'

type EditorCmdSaveState = {
  activeFileId: string | null
  activeTabType: string | null
  activeView: TopLevelView
}

export function getEditorCmdSaveFileId(state: EditorCmdSaveState): string | null {
  // Outside the workspace view no mounted editor can claim the save request.
  return state.activeView === 'terminal' && state.activeTabType === 'editor'
    ? state.activeFileId
    : null
}
