# Colab Code Editor — Client

React 19 + Vite frontend for the Colab Code Editor: the Hub, collab and exam IDE, admin dashboard, and live exam monitor. See the [root README](../../README.md) for setup, deployment and the full feature list.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

## Environment

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL, e.g. `http://localhost:3001` (a bare host gets `https://`) |
| `VITE_WS_URL` | No | WebSocket URL; defaults to `VITE_API_URL` with `http(s)` → `ws(s)` |

Vite reads these at build time, so changing them in production needs a new build. They are resolved in `src/config.ts`.

## Structure

```
src/
├── App.tsx                 # Routes; the IDE and exam monitor are lazy-loaded (they include Monaco)
├── api.ts                  # All REST calls
├── config.ts               # API / WebSocket URLs
├── monacoSetup.ts          # Uses the bundled monaco-editor with Vite-built language workers
├── collab/
│   ├── useCollabWorkspace.ts  # One Y.Doc + WebSocket per IDE session; openCollabFile(); useDirtyPaths()
│   ├── monacoBinding.ts       # Two-way Y.Text <-> Monaco model binding (trimmed fork of y-monaco)
│   └── hash.ts                # cyrb53 content hash — must match packages/server/src/collab/text.ts
├── components/
│   ├── IDELayout.tsx       # IDE shell: explorer, tabs, editor, terminal, collab + exam modes
│   ├── Editor.tsx          # Single Monaco instance with one model per open tab
│   ├── Terminal.tsx        # In-app terminal and code execution
│   └── ...
└── pages/                  # Hub, Login, Room, ExamEntry, ImportProject, AdminDashboard, AdminMonitor, CollabAdmin
```

## How the editor works

- **One connection per session.** `useCollabWorkspace` opens a single `WebsocketProvider` when the IDE mounts. The server maps it to the workspace's Yjs document. In development, React StrictMode mounts the IDE twice, so you'll see a second connection open and the first one close; production opens one.
- **File contents come from the server.** Opening a tab calls `openCollabFile()`: if the file isn't in the shared `files` map yet, it asks the server (`POST /git/open/...`) to load it from disk, then waits for it to arrive over the WebSocket. The client never writes file contents itself — the server autosaves.
- **One model per tab.** `Editor.tsx` mounts Monaco once and creates a model plus `MonacoBinding` for each open tab. Switching tabs swaps the model, keeping undo history, cursor and scroll position; background tabs keep receiving collaborators' edits. Models are disposed when their tab closes.
- **Line endings.** The shared text only ever contains `\n`, and every model is set to LF, so Monaco offsets always match the Yjs text. The server restores each file's original CRLF/BOM when saving.
- **Unsaved dot.** `useDirtyPaths` compares a hash of each open file's text with the hash the server stored in the `saved` map after its last save. The dot shows only while a change hasn't been stored yet. Ctrl+S calls `POST /git/flush/...` to save immediately.
- **Presence.** Each client publishes `user { name, id, color }`, its selection, and `activeFile` through Yjs awareness. Cursor labels are injected as CSS in `Editor.tsx`, and the exam monitor uses `activeFile` to follow what a student is editing.
