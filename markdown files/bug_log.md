# Resolved Bugs & Issues Log

This log chronicles the bugs and issues that have been addressed across the collaborative IDE platform conversations.

## 1. Authentication Middleware Token Bug ("Authentication required. No token provided.")
- **Issue:** The main backend authentication middleware failed to successfully parse JWT tokens from incoming connections, blocking users from starting new collaborative sessions entirely.
- **Root Cause:** A mismatch/misconfiguration in how the middleware intercepted the `Authorization` headers before passing the request context forward.
- **Resolution:** Updated the authentication middleware pipeline to accurately parse headers, ensuring proper extraction and validation of tokens.

## 2. Login/Signup Flow Performance Bottleneck
- **Issue:** Logging into the application or going through signup took an excessively long time, impacting the user experience heavily. 
- **Focus Area:** Improved the efficiency of SSO (Single Sign-On) mechanics and the local database verification queries to dramatically speed up user sign-in latency.
- **Resolution:** Optimized how sign-up logic and initial session handshakes were orchestrated on the server side to minimize blockages.

## 3. Server-Side Missing API Route Logging
- **Issue:** Debugging backend issues in development was difficult because the server silently executed API calls.
- **Resolution:** Embedded explicit API console request logging across the `/packages/server` environment explicitly to allow the developer to seamlessly track incoming API routes and view failure payloads.

## 4. Frontend Typescript & Unused Import Linting Errors
- **Issue:** The repository failed to build (`npm run build`) cleanly due to multiple unresolved linting problems.
- **Cases Resolved:** 
  - Framer Motion typing error in `Hub.tsx` related to the `ease` variable needing to be an `as const` tuple.
  - An unused and abandoned `BrutalCard` component import floating inside `Room.tsx`.
  - Missing typing directives (`any`) on the Admin dashboard component (`AdminDashboard.tsx`).
- **Resolution:** Patched all problematic components ensuring strict type coverage and cleaning up imports from `Room.tsx`. 

## 5. Phantom CSS Line Clamp Compatibility
- **Issue:** The `ide.css` style file utilized an outdated `line-clamp` attribute around block constraints but failed to use standard CSS properties.
- **Resolution:** Located line 1823 in `ide.css` and updated to a modern implementation that defines correct web standards for CSS line clamps and box bindings.

## 6. Exam Room Lifespan Management (No Deletion)
- **Issue:** The backend did not have a mechanic for the user to delete "Exam Rooms" after creating them, resulting in server-bloat and UI confusion.
- **Resolution:** Shipped a localized `/delete` REST endpoint specific to the exam environment, and additionally coupled it with a new red Delete button onto the Exam Room UI cards for one-click termination.

## 7. Hub Page Layout & Mobile Overflow Cutoff
- **Issue:** After designing the visual aesthetic of the main `Hub.tsx` navigation menu, the layout pushed the 4 interaction cards permanently offscreen on smaller vertical window heights.
- **Resolution:**
  - Transitioned the entire wrapper to `overflow-y-auto` allowing the user to naturally scroll when dimensions clipped.
  - Dynamically altered the column layouts to collapse gracefully (2x2 to a smaller 4-column variant based on breakpoint).

## 8. Imported Repository State Overwrite Bug (Flashing Text)
- **Issue:** When a user successfully imported a new GitHub project, clicking on files inside the project tree resulted in the immediate flashing of lines then total erasure of all text contents.
- **Root Cause:** A Yjs (Collaborative layer) Websocket synchronization race condition. When the file loaded locally, a split-second later the WebSocket sent down an "Empty Session State" signal for that file and aggressively overwrote the local text buffer.
- **Resolution:** Patched `Editor.tsx` by attaching an `on('sync')` listener. During the initial synchronization handshake, the editor intercepts the blank payload, explicitly populates the local disk content into the remote Yjs document memory bank, and correctly broadcasts the code content.

## 9. Path Traversal Sandbox Breach on File Downloads
- **Issue:** When a user attempted to download a single file from the IDE (like `/photo.JPG`), the backend threw a `500 Internal Server Error` claiming a "Sandbox breach blocked" and failed the download.
- **Root Cause:** The `GitService.ts` resolved paths using NodeJS `path.resolve()`. Because the frontend passed single-file requests with a leading forward slash, NodeJS interpreted it as an absolute path pointing to the root of the server's hard drive, causing the anti-traversal security mechanism to instantly kill the request.
- **Resolution:** Modified the `/download/:workspaceId` endpoint to cleanly strip any leading `/` strings using Regex (`^\/`) from the incoming `filePath` payload before processing it, ensuring it stays safely scoped to the isolated workspace container.

## 10. API Latency — PrismaClient Connection Exhaustion
- **Issue:** All API endpoints (exam creation, auth, role checks) became extremely slow (~3+ seconds each), causing timeouts and degraded user experience under even light usage.
- **Root Cause:** Every module (`auth.ts`, `exam.ts`, `passport.ts`, etc.) was instantiating its **own** `new PrismaClient()`. Each instance opened a separate connection pool to PostgreSQL. Under concurrent requests, the database hit its connection ceiling and started queuing/throttling new connections.
- **Resolution:** Created a centralized singleton `db.ts` exporting a single shared `PrismaClient` instance. Updated all modules (`routes/auth.ts`, `routes/exam.ts`, `config/passport.ts`, `middleware/auth.ts`, `socket/index.ts`) to import from `../db` instead of creating their own client. This collapsed ~5 connection pools into one.

## 11. Blocking Request Logger Freezing the Event Loop
- **Issue:** After implementing the request logger middleware (`requestLogger.ts`), certain API calls (especially `POST` requests with large payloads like ZIP uploads or code submissions) would hang the entire server for several seconds.
- **Root Cause:** The logger middleware was synchronously deep-cloning and `JSON.stringify()`-ing the **entire** `req.body` payload on every incoming request — purely for debug logging. On large payloads (multi-MB ZIPs, large code blocks), this blocked the Node.js V8 event loop thread until the stringification completed.
- **Secondary Issue:** `Object.keys(req.params)` threw a `TypeError: Cannot convert undefined or null to object` on routes where `req.params` was undefined, crashing the logger entirely on exam creation calls.
- **Resolution:**
  - Disabled the synchronous body stringification for all requests: `// bodySnippet = '(body logging disabled)';`
  - Added a null-safety guard: `Object.keys(req.params || {})` to prevent crashes on parameter-less routes.

## 12. `requireRole` Middleware Hammering the Database
- **Issue:** Every single role-protected API call (`/exam`, `/exam/create`, admin endpoints) triggered a fresh `prisma.user.findUnique()` database query to check the user's role, even though roles rarely change during a session.
- **Root Cause:** The `requireRole` middleware had no caching — it always hit the database.
- **Resolution:** Implemented an in-memory `Map<string, { role: string; cachedAt: number }>` cache inside `middleware/auth.ts`. Roles are cached for 5 minutes before being re-fetched. This eliminated >90% of role-check database calls.

## 13. Exam Room Isolation Bypass — Critical Security Vulnerability
- **Issue:** Users could bypass the strict separation between Collaboration and Exam environments. A student could enter an exam room code into the **Collab Hub** "Join Room" field, navigate to `/room/EX-xxxx`, and open the full collaborative IDE with no exam restrictions applied. Conversely, students could access collaboration rooms from the exam entry point.
- **Root Cause (Multi-layered):**
  1. **No Room record on exam creation:** `POST /exam/create` only created an `Exam` database row but **never created a `Room` record** with an `EX-` prefixed name. The Admin Dashboard displayed the raw Exam UUID (e.g. `a1b2c3d4-...`), which is not an `EX-` room code.
  2. **Blind prefix auto-prepending:** The Hub's student form naively prepended `EX-` to whatever the student typed. If the admin shared the Exam UUID and the Collab Hub generated `CR-` prefixed rooms, a student entering a collab room ID would produce nonsensical URLs like `/e/EX-CR-1ky8mgav`.
  3. **No frontend route guard:** `IDELayout.tsx` never validated whether the `roomId` prefix matched the access mode. Navigating to `/room/EX-xxxx` opened a full collab IDE, and `/e/CR-xxxx` opened exam mode on a collab room.
  4. **Broken exam ID extraction:** `IDELayout` extracted the exam UUID by splitting the room code on `-` (`roomId.split('-')[1]`), which returned gibberish for codes like `EX-a1b2c3d4` (it returned `a1b2c3d4`, not the actual Exam UUID from the database).
  5. **Route parameter mismatch:** `App.tsx` defined the exam route as `/e/:examId`, but `IDELayout` destructured `useParams<{ roomId }>` — so `examId` was never available in the component, and `roomId` was `undefined` on exam routes.
- **Resolution (End-to-end, 6 files):**
  - **Backend `routes/exam.ts`:**
    - `POST /exam/create` now auto-creates an associated `Room` record with `name: "EX-<random8hex>"`, `type: "EXAM"`, linked to the exam via `examId`. Returns `roomCode` in the response.
    - `GET /exam` now joins the `Room` table and returns `roomCode` for each exam so the admin dashboard displays the shareable `EX-` code.
    - Added `GET /exam/resolve/:roomCode` — resolves an `EX-xxxx` room code into full exam metadata by looking up the `Room` → `Exam` relationship. Returns `{ room, exam }`.
  - **Frontend `api.ts`:** Added `resolveExamRoom()` function and `roomCode` to `ExamRoom` interface.
  - **Frontend `AdminDashboard.tsx`:** Exam cards now display the `EX-xxxx` room code with a copy-to-clipboard button (instead of a truncated UUID).
  - **Frontend `Hub.tsx`:** Student exam form now **validates** the code starts with `EX-` and rejects anything else with an error message. No more silent auto-prefixing.
  - **Frontend `Room.tsx` (Collab Hub):**
    - Room creation always generates `CR-` prefixed codes.
    - "Join Room" field blocks any `EX-` prefixed input with an error: *"Cannot join an exam from the Collab Hub."*
    - Non-prefixed codes get `CR-` auto-prepended.
  - **Frontend `IDELayout.tsx`:**
    - Added a **Room Type Validation Guard**: If `roomId` starts with `EX-` but the route is `/room/` (collab), or if `roomId` doesn't start with `EX-` but the route is `/e/` (exam), the component renders a full-screen **ACCESS DENIED** blocker with a "Back to Hub" button.
    - Replaced string-parsing (`split('-')[1]`) with a proper `resolveExamRoom(roomCode)` API call that returns the real exam UUID from the database.
    - If `resolveExamRoom` fails (invalid/nonexistent code), the room is blocked with a clear error.
    - All `exId`/`examId` references updated to `resolvedExamId`.
  - **Frontend `App.tsx`:** Exam route changed from `/e/:examId` to `/e/:roomId` to match `IDELayout`'s `useParams` destructuring.

## 14. Import Repository — Workspace ID Mismatch (Missing Files on Rejoin)
- **Issue:** After importing a GitHub repository via the "Import Project" card on the Hub, the user could open the IDE and see their files. However, if they left and later tried to rejoin the same room from the Collab Hub's "Join Room" field, the workspace appeared empty — all cloned files were gone.
- **Root Cause:** `Hub.tsx` had its own `generateRoomId()` function that returned a **bare 8-character ID** (e.g. `1ky8mgav`) without the `CR-` prefix. The repo was cloned into workspace `1ky8mgav` and the initial navigation went to `/room/1ky8mgav`. Later, when the user tried to rejoin via the Collab Hub's "Join Room" input, `Room.tsx` auto-prepended `CR-`, navigating to `/room/CR-1ky8mgav` — a completely different workspace ID with no files.
- **Resolution:** Added the `CR-` prefix to `Hub.tsx`'s `generateRoomId()` function (`return \`CR-${result}\``) so imported repos get consistent workspace IDs from the start, matching the convention enforced by `Room.tsx`.

## 15. Exam Room Student Isolation — Code Leaking Between Accounts
- **Issue:** When Student A joined an exam room and wrote code, Student B joining the same exam room could see Student A's code and files. There was no per-student isolation.
- **Root Cause (two layers):**
  1. **Shared workspace directory:** `IDELayout.tsx` used `workspaceId = roomId` (e.g. `EX-a1b2c3d4`) for ALL students. Every student initialized, read, and wrote files to the same directory on disk. Student B would see Student A's files immediately.
  2. **WebSocket session gating too strict:** The WebSocket handler required an already-existing `ExamSession` with `status: 'ACTIVE'` before allowing a student to connect. But the session was only created later by the `joinExam()` HTTP call (which fires after the editor mounts). This race condition meant the WebSocket often connected before the session existed, and would reject the student entirely.
- **Resolution:**
  - **Per-student workspaces:** In exam mode, `workspaceId` now includes the user's ID extracted from the JWT: `EX-a1b2c3d4__<userId>`. Each student gets their own isolated filesystem directory.
  - **Auto-create sessions on WebSocket connect:** The socket handler now auto-creates an `ExamSession` if one doesn't exist, instead of rejecting the connection. This eliminates the race condition.

## 16. Admin Monitor — Live Code Preview Always Empty
- **Issue:** The Admin Monitor page showed student names from the logs, but the live code editor previews for each student were always empty — the admin could not see what students were typing.
- **Root Cause (namespace mismatch):** The `AdminMonitor.tsx`'s `StudentPreview` component connected to WebSocket namespace `/e/${examId}/s/${studentName}`, but this path did not map to any real Yjs document. Students were connected to documents named `exam:${examId}:${userId}` (resolved server-side). The admin was connecting to a completely different, nonexistent document.
- **Resolution:**
  - **Frontend (`AdminMonitor.tsx`):** `StudentPreview` now connects to `monitor:${examId}:${studentId}` (using the student's user ID, not username).
  - **Backend (`socket/index.ts`):** Added a `monitor:` prefix handler. When the URL path starts with `monitor:examId:studentId`, the server verifies the user has `ADMIN` role, then maps the connection to the **same** Yjs document the student writes to (`exam:${examId}:${studentId}`). This gives the admin a live read-only view of each student's code.
  - **Copy-paste alerts (`Editor.tsx`):** Added `examId` prop so `sendExamAlert()` uses the correct exam UUID instead of the broken `roomId.split('-')[1]` extraction.

## 17. Imported Repo — Slow File Opens, False "Unsaved" Tabs, and Lost Work on Reload
- **Issue:** After importing a GitHub repository, every file took noticeably long to open, tabs showed the unsaved dot without any edits, and content was lost or swapped between files after a page reload. On the deployed Render free plan, whole workspaces also disappeared after the service restarted or slept.
- **Root Cause (several layers):**
  1. **One shared text for every file:** `Editor.tsx` bound every file to the same `doc.getText('monaco')`, and the server used one doc per room. Opening file B showed whatever the room's text held (usually file A). That differed from B on disk, so the tab went dirty and the 2-second autosave wrote A's content into B.
  2. **Remount per file:** `<CodeEditor key={activeTab}>` rebuilt Monaco on every open, and each mount opened a new WebSocket (JWT check + database user lookup + full sync) plus an HTTP read.
  3. **Content never reached the editor:** the editor mounted before `readFile` resolved, and `@monaco-editor/react` captures `onMount` only once, so the downloaded text was ignored. Seeding the shared text from the client was also racy — two clients could insert the same content twice. (This replaces the approach from entry 8.)
  4. **Line endings on Windows:** Monaco defaults to CRLF on Windows, so LF files never matched their disk content and always looked modified; it also shifted y-monaco's offsets.
  5. **Unsafe client saves:** the save-on-hide handler PUT every open tab, including `// Error loading file` placeholders, which overwrote binary files.
  6. **Ephemeral storage:** workspaces and sessions lived only on the Render free-plan disk, which is wiped on every restart, redeploy or idle spin-down.
- **Resolution:**
  - **Server-owned documents (`collab/persistence.ts`):** one Yjs doc per workspace (`ws-<workspaceId>`) with a `files` map holding one shared text per path. Only the server adds entries, loading a file from disk the first time it is opened (`POST /git/open`), so content can't be duplicated. Edits are autosaved to disk and Postgres (1 s debounce, 5 s max) and flushed when the last user leaves or on `SIGTERM`; `POST /git/flush` saves on Ctrl+S. All disk/DB work per workspace runs through a lock (`collab/lock.ts`) so a reload can't read a file while the previous save is still writing.
  - **Accurate unsaved state:** the doc's `saved` map stores a hash of each file's last saved version; a tab is dirty only while its text hash differs.
  - **Line endings:** shared text always uses `\n`; the server records each file's CRLF/BOM and restores it when writing (`collab/text.ts`).
  - **Client (`useCollabWorkspace.ts`, `Editor.tsx`, `monacoBinding.ts`):** one WebSocket and one Monaco instance per session, one model per open tab (switching = `editor.setModel`), every model forced to LF. Replaced `y-monaco` with a trimmed fork that doesn't import a second copy of Monaco or leak listeners, and bundled Monaco instead of loading it from a CDN.
  - **Durability (`WorkspaceStore.ts`):** every file change is written through to the `File` table; files missing from disk are restored on first use. IDE sessions and custom extensions moved from JSON files to Postgres (`IdeSession`, `CustomExtension`). `.git` is not persisted.
  - **Smaller fixes:** `initWorkspace` no longer adds `main.py` to imported repos; binary/oversized files show a notice and are never written by the editor; tabs close when a collaborator deletes or renames a file; guests can connect to collab rooms; admin-monitor read-only is enforced on the server and the monitor follows the student's active file.
