import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import CommentMarkdown, {
  type CommentMarkdownLinkClickHandler
} from '@/components/sidebar/CommentMarkdown'
import { translate } from '@/i18n/i18n'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export function NativeChatReasoning({
  markdown,
  active,
  onLinkClick,
  allowFileUriLinks
}: {
  markdown: string
  active: boolean
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks: boolean
}): React.JSX.Element {
  const [userOpen, setUserOpen] = useState(false)
  const open = active || userOpen

  return (
    <Collapsible open={open} onOpenChange={setUserOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1 rounded py-0.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          aria-hidden
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        {translate('components.native-chat.status.thoughts', 'Thoughts')}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 border-l-2 border-border/60 pl-3 text-sm italic text-muted-foreground">
        <CommentMarkdown
          content={markdown}
          variant="document"
          className="text-sm"
          onLinkClick={onLinkClick}
          allowFileUriLinks={allowFileUriLinks}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}
