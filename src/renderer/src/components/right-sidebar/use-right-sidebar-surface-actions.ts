import {
  Bot,
  FileDiff,
  Files,
  GitPullRequest,
  GitPullRequestArrow,
  Globe,
  Smartphone,
  TerminalSquare
} from 'lucide-react'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { getClientCreationActionPolicy } from '@/lib/client-creation-action-policy'
import { openMobileEmulatorTab } from '@/lib/open-mobile-emulator-tab'
import { ensureSimulatorTab, getSimulatorTabForWorktree } from '@/lib/ensure-simulator-tab'
import type { ActiveRightSidebarTab } from '@/store/slices/editor'
import type { ActivityBarItem } from './activity-bar-buttons'
import { ensureSidebarSurfaceGroup } from './sidebar-surface-creation'
import type { SidebarSurfaceAction } from './RightSidebarSurfaceLauncher'

export function useRightSidebarSurfaceActions(
  items: ActivityBarItem[],
  onSelect: (tab: ActiveRightSidebarTab) => void,
  onShowTabs: () => void
): SidebarSurfaceAction[] {
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const browserAvailable = useAppStore(
    (state) =>
      getClientCreationActionPolicy(state, state.activeWorktreeId)['managed-browser'].state ===
      'enabled'
  )
  const deviceAvailable = useAppStore(
    (state) =>
      state.settings?.mobileEmulatorEnabled !== false &&
      getClientCreationActionPolicy(state, state.activeWorktreeId)['mobile-emulator'].state ===
        'enabled'
  )
  const panelAction = (
    id: ActiveRightSidebarTab,
    title: string,
    icon: ActivityBarItem['icon'],
    key: string
  ): SidebarSurfaceAction => ({
    id,
    title,
    icon,
    key,
    disabled: !worktreeId || !items.some((item) => item.id === id),
    onOpen: () => onSelect(id)
  })
  const openTab = async (kind: 'browser' | 'terminal' | 'simulator') => {
    if (!worktreeId || useAppStore.getState().activeWorktreeId !== worktreeId) {
      return
    }
    const groupId = ensureSidebarSurfaceGroup(worktreeId)
    const state = useAppStore.getState()
    const existing = state.unifiedTabsByWorktree[worktreeId]?.find(
      (tab) => tab.groupId === groupId && tab.contentType === kind
    )
    if (existing) {
      state.activateTab(existing.id)
    } else if (kind === 'terminal') {
      await state.openNewTerminalTabInActiveWorkspace(groupId)
    } else if (kind === 'browser') {
      await state.openNewBrowserTabInActiveWorkspace(groupId)
    } else {
      const simulator = getSimulatorTabForWorktree(worktreeId)
      if (simulator) {
        state.moveUnifiedTabToGroup(simulator.id, groupId, { activate: true })
        ensureSimulatorTab(worktreeId, { surfacePane: true })
      } else {
        await openMobileEmulatorTab(worktreeId, {
          targetGroupId: groupId,
          placement: 'activeGroup'
        })
      }
    }
    if (useAppStore.getState().activeWorktreeId === worktreeId) {
      onShowTabs()
    }
  }
  const primaryIds = new Set(['explorer', 'source-control', 'checks', 'pr-checks', 'vault'])

  return [
    {
      id: 'browser',
      title: translate('sidebar.surfaces.browser', 'Browser'),
      icon: Globe,
      key: 'B',
      disabled: !worktreeId || !browserAvailable,
      onOpen: () => openTab('browser')
    },
    {
      id: 'terminal',
      title: translate('sidebar.surfaces.terminal', 'Terminal'),
      icon: TerminalSquare,
      key: 'T',
      disabled: !worktreeId,
      onOpen: () => openTab('terminal')
    },
    panelAction('explorer', translate('sidebar.surfaces.files', 'Files'), Files, 'F'),
    panelAction('source-control', translate('sidebar.surfaces.diff', 'Diff'), FileDiff, 'D'),
    // Review names stay provider-neutral because these panels also serve GitLab and other hosts.
    panelAction('checks', translate('sidebar.surfaces.review', 'Review'), GitPullRequest, 'P'),
    panelAction(
      'pr-checks',
      translate('sidebar.surfaces.linkedReviews', 'Linked reviews'),
      GitPullRequestArrow,
      'L'
    ),
    panelAction('vault', translate('sidebar.surfaces.agents', 'Agents'), Bot, 'A'),
    {
      id: 'device',
      title: translate('sidebar.surfaces.device', 'Device'),
      icon: Smartphone,
      key: 'M',
      disabled: !worktreeId || !deviceAvailable,
      onOpen: () => openTab('simulator')
    },
    ...items
      .filter((item) => !primaryIds.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        icon: item.icon,
        disabled: !worktreeId,
        onOpen: () => onSelect(item.id)
      }))
  ]
}
