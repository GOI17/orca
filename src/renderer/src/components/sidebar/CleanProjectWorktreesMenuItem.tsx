import { useState } from 'react'
import { BrushCleaning, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'

export function CleanProjectWorktreesMenuItem({ repo }: { repo: Repo }): React.JSX.Element {
  const [checking, setChecking] = useState(false)

  const clean = async (): Promise<void> => {
    if (checking) {
      return
    }
    setChecking(true)
    try {
      const { cleanProjectWorktrees } = await import('./clean-project-worktrees')
      await cleanProjectWorktrees(repo)
    } catch {
      toast.error(translate('worktreeCleanup.failed', 'Could not check worktrees'))
    } finally {
      setChecking(false)
    }
  }

  return (
    <DropdownMenuItem disabled={checking} onSelect={() => void clean()}>
      {checking ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <BrushCleaning className="size-3.5" />
      )}
      {translate('worktreeCleanup.action', 'Clean up worktrees')}
    </DropdownMenuItem>
  )
}
