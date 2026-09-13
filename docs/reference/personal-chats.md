# Personal chats

Personal chats are a desktop page, independent of projects and the floating workspace.
The `personal-chats` session key owns its tab history; it is not a registered repository,
folder workspace, or Git worktree. The renderer keeps the selected project unchanged.

The host resolves file operations and structured session creation to a managed directory
under its user-data directory. Renderer ownership resolves explicitly to `local`, even
when a paired runtime or SSH project is selected. Generic Git/worktree mutation APIs do
not resolve this key. File links open in the system application.

The first new chat persists `personalChatsEnabled`, enabling the existing structured
session engine without changing project chat preferences. Codex and Claude share the
existing launch reconciliation, account selection, tool approval, journal, draft cache,
and host session visibility index. Renames use the existing persisted tab labels.

Only clients advertising `personal-chats.v1` receive personal chat tabs. The desktop IPC
bridge advertises it; older paired clients and mobile receive an empty projection with
no dangling tab selection. No new stream opcode or session-record format is introduced.

Coverage: directory creation without a repository store, owner routing under a selected
remote runtime, launch failure/reconciliation, capability projection, and hidden Electron
creation, naming, draft switching, and reload restoration.
