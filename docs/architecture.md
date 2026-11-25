# Architecture

[Back to the README](../README.md), which has the system, saving, judging and roles diagrams.

- [Workspaces](#workspaces)
- [Editing and saving](#editing-and-saving)
- [Project structure](#project-structure)

## Workspaces

Everything people edit belongs to a workspace: a folder on disk, a set of rows in Postgres, and one live document. Its id decides who can open it.

| Kind | Code | Workspace id | Who can open it |
|---|---|---|---|
| Collab room | `CR-xxxxxxxx` | the room code | People who were let in, with their room's role |
| Exam | `EX-XXXXXXXX` | `<code>__<userId>` | That student. Admins can watch. |
| Contest | `CT-XXXXXXXX` | `<code>__<userId>` | That participant. The organizer can watch. |

Students and contest participants get a workspace each, so they can't see one another's code. The `EX-` and `CT-` prefixes are reserved, so a collab room can't alias an exam or contest workspace.

## Editing and saving

Every workspace has **one Yjs document on the server**, named `ws-<workspaceId>`. It holds:

- `files`: one shared text per file path. Only the server adds entries. The first time anyone opens a file, the client calls `POST /git/open/...` and the server loads it from disk. The content then reaches every client over the WebSocket, so two people opening the same file can never duplicate it.
- `saved`: a hash of each file's last saved version, and whether it uses CRLF line endings or a BOM.

**In the browser**, the IDE keeps one document WebSocket and one Monaco editor for the whole session. Each open tab gets its own Monaco model bound to that file's shared text, so switching tabs is a model swap that keeps undo history, cursor and scroll position. A tab shows the unsaved dot while the hash of its text differs from the saved hash.

**On the server**, edits are written to disk about a second after they happen (five seconds at most while someone keeps typing), then to Postgres. Saving also happens right away when the last person leaves, on `SIGTERM` or `SIGINT`, and on Ctrl+S (`POST /git/flush/...`). Git commit, status and push, and workspace downloads, save pending edits first.

**Failures:** if the database is unreachable, the file stays marked unsaved and the save is retried with backoff. If a file changed on disk since the document last saved it, the disk wins.

**Line endings:** the shared text always uses `\n`. The server remembers each file's line ending and BOM and restores them when writing, so Windows and Unix files keep their format.

**Durability:** the disk under `DATA_DIR` is the working copy. Every change is also written to the `File` table, and files missing from disk are restored from there on first use. `.git`, `node_modules`, virtual environments and similar folders are not stored in Postgres.

**Locking:** all disk and database work for a workspace (saves, file loads, file operations, git commands) runs one at a time through a per-workspace lock. A page reload can't load a file while the previous connection's final save is still being written.

**Read-only people:** the server drops document updates from anyone who may not edit, and checks on every message, so a role change takes effect on the open connection.

## Project structure

```
packages/
├── client/                         React + Vite
│   └── src/
│       ├── App.tsx                 Routes
│       ├── api.ts                  REST calls
│       ├── roomApi.ts              Collab room access calls
│       ├── contestApi.ts           Contest calls and display helpers
│       ├── config.ts               API and WebSocket URLs
│       ├── monacoSetup.ts          Bundled Monaco, workers and editor themes
│       ├── pages/
│       │   ├── Hub.tsx             Home (/)
│       │   ├── Login.tsx           Sign in and register (/login)
│       │   ├── Room.tsx            Create or join a room (/collab)
│       │   ├── CollabAdmin.tsx     Room presence view (/collab-admin/:roomId)
│       │   ├── ImportProject.tsx   Import from GitHub (/import)
│       │   ├── ExamEntry.tsx       Student exam entry (/take-exam)
│       │   ├── AdminDashboard.tsx  Proctor dashboard (/admin)
│       │   ├── AdminMonitor.tsx    Live exam monitor (/exam/:id/monitor)
│       │   ├── ContestsHome.tsx    Join or create contests (/contests)
│       │   ├── ContestManage.tsx   Organizer settings (/contests/:id/manage)
│       │   ├── ContestMonitor.tsx  Organizer live view (/contests/:id/monitor)
│       │   └── ContestArena.tsx    Participant lobby and editor (/c/:code)
│       ├── collab/
│       │   ├── useCollabWorkspace.ts  One Yjs document and WebSocket per session
│       │   ├── useRoomAccess.ts       Room role, join requests, control channel
│       │   ├── monacoBinding.ts       Yjs text <-> Monaco model (fork of y-monaco)
│       │   └── hash.ts                Content hash shared with the server
│       ├── components/
│       │   ├── IDELayout.tsx       IDE shell (/room/:roomId and /e/:roomId)
│       │   ├── Editor.tsx          One Monaco instance, one model per tab
│       │   ├── Terminal.tsx        Terminal and code execution
│       │   ├── FileExplorer.tsx    File tree
│       │   ├── GitPanel.tsx        Source control
│       │   ├── RoomGate.tsx        "Waiting to be let in" screen
│       │   ├── RoomMembers.tsx     People, roles and requests
│       │   ├── CommentsPanel.tsx   Room comment thread
│       │   ├── LiveCodePreview.tsx Read-only live view for monitors
│       │   ├── ProctoringOverlay.tsx
│       │   ├── RouteA11y.tsx       Page titles and focus on navigation
│       │   ├── contest/            Leaderboard, verdicts, markdown, SQL tables
│       │   └── ui/                 Buttons, fields, dialogs and other primitives
│       ├── contexts/               Theme, toasts, confirm dialogs
│       └── hooks/useProctoring.ts  Fullscreen, tab-switch and clipboard rules
├── server/                         Express API + WebSocket server
│   ├── src/
│   │   ├── index.ts                Entry, routes, shutdown
│   │   ├── socket/index.ts         WebSocket modes and who may connect
│   │   ├── middleware/             Auth, rate limits, request log
│   │   ├── routes/                 auth, git, execution, sessions, exam, contests, collab
│   │   ├── collab/
│   │   │   ├── persistence.ts      Live documents, autosave, shutdown flush
│   │   │   ├── rooms.ts            Room roles, requests, presence, comments
│   │   │   ├── lock.ts             Per-workspace lock
│   │   │   ├── text.ts             Line endings, BOM and content hash
│   │   │   └── workspace.ts        Workspace access checks
│   │   └── services/
│   │       ├── GitService.ts       Files on disk and isomorphic-git
│   │       ├── WorkspaceStore.ts   Durable copy of files in Postgres
│   │       ├── executionService.ts Piston and Wandbox
│   │       ├── sessionService.ts   IDE sessions
│   │       ├── extensionRegistry.ts
│   │       └── contest/            Judge, verdicts, leaderboard, SQL runner, test upload
│   └── prisma/schema.prisma
└── shared/                         Shared package
```
