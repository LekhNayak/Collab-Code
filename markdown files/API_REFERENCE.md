# API Reference & Documentation

This document covers all the API endpoints used in the **Colab Code Editor** application, categorizing them by domain and detailing every single use case.

---

## 🔐 1. Authentication APIs (`/auth`)
These APIs handle user identity, logins, and session persistence. They do not require authentication themselves.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/auth/register` | `POST` | Creates a new user account with `username`, `email`, and `password`. Returns a JWT token upon success. Used in the Signup page. |
| `/auth/login` | `POST` | Authenticates an existing user using `email` and `password`. Returns a JWT token. Used in the Login page. |
| `/auth/github` | `GET` | Initiates OAuth2 flow for GitHub login. The frontend redirects to this URL to trigger GitHub's authentication page. |
| `/auth/github/callback` | `GET` | Callback URL for GitHub OAuth. The backend processes the GitHub profile, retrieves/creates the user, generates a JWT, and redirects the browser back to the frontend with the token. |
| `/auth/guest` | `POST` | Generates a temporary guest user account and returns a short-lived token. Used for users who want to try the IDE without creating a permanent account. |
| `/auth/me` | `GET` | Validates the current user's JWT token and returns their profile information. Used by the frontend on initial load to verify if the user is logged in. |

---

## 📁 2. File System & Workspace APIs (`/git/file` & `/git/tree`)
These APIs manage the actual filesystem of a user's remote workspace. They are used extensively by the IDE's file explorer and code editor.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/git/init` | `POST` | Prepares a workspace when the IDE opens. Restores any files missing from disk from the database, and adds a starter `main.py` only to a brand-new, empty workspace (never to an imported repo). |
| `/git/tree/:workspaceId` | `GET` | Fetches the full directory and file tree structure of a workspace. Used to populate the IDE sidebar. |
| `/git/open/:workspaceId/:path` | `POST` | Loads a file into the workspace's live collaborative document. Called when a tab is opened and the file isn't loaded yet; the content then arrives over the WebSocket. Returns `404` (missing), `413` (over 5 MB) or `415` (binary / non-UTF-8). |
| `/git/flush/:workspaceId` | `POST` | Saves pending editor changes to disk and the database right away. Triggered by `Ctrl+S`; the server otherwise autosaves about a second after each edit. Returns `{ saved: false }` if something couldn't be stored yet (it is retried). |
| `/git/file/:workspaceId/:path` | `GET` | Reads the text content of a file — the live editor content if the file is open. Used by the terminal's `cat`. |
| `/git/file/:workspaceId/:path` | `PUT` | Overwrites a file's content; anyone with the file open sees the new content. The IDE itself no longer uses this — the server autosaves editor changes. |
| `/git/file/:workspaceId/:path` | `POST` | Creates a new file or directory (based on an `isDirectory` flag). Used when a user right-clicks the tree and selects "New File" or "New Folder". |
| `/git/file/:workspaceId/:path` | `DELETE` | Permanently deletes a file or directory from the workspace. Open tabs for it close for every user. |
| `/git/file/:workspaceId` | `PATCH` | Renames or moves a file/folder to a new path. Used when a user uses the "Rename" functionality. Unsaved edits move with the file. |
| `/git/upload/:workspaceId` | `POST` | A multipart/form-data endpoint to bulk upload directories or `.zip` files. Extracts zip files automatically if `mode=zip`. Open files that the upload replaced update in place. |

Every change made through these endpoints (and every autosave) is also written to the database, so a workspace survives a wiped server disk. `.git` is not stored, so git history does not survive a wipe.

---

## 🌿 3. Git Version Control APIs (`/git`)
These APIs allow the user to execute raw Git commands visually through the application.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/git/clone` | `POST` | Clones a repository from a given URL into a fresh workspace. Used in the "Import Project" flow on the Hub. Returns `409` if the workspace already contains files. |
| `/git/repo/init/:workspaceId` | `POST` | Executes `git init` to turn a local unwatched workspace directory into a Git repository. |
| `/git/status/:workspaceId` | `GET` | Executes `git status`. Used to display changed files, staged files, branches, and remotes in the Source Control panel. Status, add, commit and push save pending editor changes first, so they always see the latest edits. |
| `/git/add/:workspaceId` | `POST` | Stages specific files (or all changed files) to the Git index (`git add`). |
| `/git/unstage/:workspaceId` | `POST` | Removes files from the Git staging area without losing their local changes (`git reset HEAD`). |
| `/git/commit/:workspaceId` | `POST` | Creates a new commit with the currently staged files (`git commit -m "..."`). |
| `/git/push/:workspaceId` | `POST` | Pushes local branch commits up to a remote repository (`git push`). Can accept GitHub personal access tokens. |
| `/git/pull/:workspaceId` | `POST` | Pulls remote commits into the local branch (`git pull`). |
| `/git/log/:workspaceId` | `GET` | Fetches the commit history (`git log`). Used to display the timeline/history visualizer of the repository. |
| `/git/branches/:workspaceId` | `GET` | Retrieves all local/remote branches and identifies the currently checked-out branch. |
| `/git/checkout/:workspaceId` | `POST` | Switches the active workspace entirely over to a different branch (`git checkout`). |
| `/git/branch/:workspaceId` | `POST` | Creates a new local branch and optionally checks it out immediately (`git checkout -b`). |
| `/git/remote/:workspaceId` | `POST` | Adds a new remote URL alias (like `origin`) to the local Git repository (`git remote add`). |

---

## ⚡ 4. Code Execution APIs (`/execute`)
These APIs take user code and run it within sandboxed environments or processes on the backend server.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/execute/run/direct` | `POST` | Executes code synchronously and waits for the full terminal output before returning the HTTP response. Used by the "Run Code" button for immediate, lightweight execution blocks. |
| `/execute/run` | `POST` | Adds a code execution job to an asynchronous queue, returning a `jobId` immediately without waiting for it to finish. Meant for long-running scripts or heavy compilations. |
| `/execute/result/:jobId` | `GET` | Polls the status of an asynchronous job initiated by `/run`. Returns whether the job is `queued`, `running`, `completed`, or `failed` along with `stdout`/`stderr`. |

---

## 💾 5. Sessions & Extensions APIs (`/sessions`)
These APIs handle user-specific IDE configuration metadata—saving their preferred themes, what tabs they left open, and which plugins they use.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/sessions` | `POST` | Creates a persistent "coding session" metadata record linking a user, a workspace, and a collaborative socket `roomId`. Sessions are stored in the database (`IdeSession` table). |
| `/sessions` | `GET` | Retrieves all currently active and past sessions for a user. Used to render the "Recent Projects" list in the Hub. |
| `/sessions/:id` | `GET` | Fetches the detailed metadata (open tabs, settings, installed extensions) for a specific session to rehydrate the IDE upon page load. |
| `/sessions/:id` | `PUT` | Updates session metadata asynchronously as the user changes settings or opens/closes tabs, allowing them to resume exactly where they left off later. |
| `/sessions/:id` | `DELETE` | Permanently deletes a session history item from the database. |
| `/sessions/extensions` | `GET` | Retrieves all globally available public extensions (Themes, snippets, formatters) from the marketplace. |
| `/sessions/:id/extensions` | `POST` | Saves an extension ID to the user's specific session config, effectively "installing" it. |
| `/sessions/:id/extensions/:extId`| `DELETE` | Removes an extension from a session. |
| `/sessions/extensions/custom` | `POST` | Creates a user-defined custom IDE extension/tool and registers it in the database. |
| `/sessions/extensions/custom/:id`| `DELETE` | Deletes a custom user extension. |

---

## 🎓 6. Exam Portal APIs (`/exam`)
These APIs handle the specialized "Exam/Interview" mode features, which includes activity monitoring and separated constraints for test environments.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/exam` | `POST` | Creates a new exam room with a title and start/end time. Used by an Admin or Instructor. |
| `/exam` | `GET` | Retrieves all exam rooms currently active or upcoming. |
| `/exam/:examId` | `GET` | Retrieves the details, timers, and metadata of a specific exam room. |
| `/exam/:examId/join` | `POST` | Registers a student/participant into an exam room session and verifies their access rights. |
| `/exam/:examId/logs` | `GET` | Fetches the activity tracking logs (e.g., cheating alerts, tab switches, execution runs) for an exam session. Used in the Admin Monitor dashboard. |
| `/exam/:examId/execute` | `POST` | A specialized wrapper around the standard code execution engine, but automatically logs the execution and its snapshot to the exam integrity database. |
| `/exam/:examId/alert` | `POST` | Pinged exclusively by the frontend when a suspicious event occurs (e.g., the student pastes a large chunk of text into the editor). Logs an "Exam Alert" for the instructor. |
| `/exam/:examId` | `DELETE` | Deletes an exam room and clears its associated logs. |

---

## 🏆 7. Contest APIs (`/contests`)
Competitive-coding contests. Any registered user can organize; guests get `403` ("Contests need an account"). Organizer routes check that the caller owns the contest. Participants see only sample tests; hidden test cases never leave the server. Every participant-facing response includes `serverNow` so countdowns can correct for a wrong local clock.

**Organizer**

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/contests` | `POST` | Creates a contest (`title`, optional `description`, `durationMinutes`, `languages`, `leaderboard` = `LIVE`/`AFTER_END`, `proctoring`, `maxTabSwitches`). Returns it with its `CT-XXXXXXXX` code. |
| `/contests/mine` | `GET` | Contests the caller organizes (with problem and participant counts) and contests they have joined. |
| `/contests/:id/admin` | `GET` | Full organizer view: settings, problems, and test metadata with short previews and sizes. |
| `/contests/:id` | `PATCH` | Updates settings. Changing the duration while live moves the end time (extend / shorten). |
| `/contests/:id/start` | `POST` | Starts now, or schedules for `{ at }`. Every problem needs at least one test. |
| `/contests/:id/unschedule` · `/contests/:id/end` | `POST` | Back to draft; end a running contest now. |
| `/contests/:id` | `DELETE` | Deletes the contest, its submissions and the participants' code workspaces. |
| `/contests/:id/judge-info` | `GET` | Judge backend (`wandbox` / `piston`), concurrency, max time limit, languages. |
| `/contests/:id/problems` | `POST` | Adds a problem (next letter A, B, …): `title`, `statement` (markdown), `points`, `timeLimitMs`, `memoryLimitMb`. |
| `/contests/:id/problems/:pid` | `PATCH` / `DELETE` | Edits a problem (changing points rescales existing scores); deletes it (only before the start). |
| `/contests/:id/problems/:pid/rejudge` | `POST` | Judges every finished submission of the problem again (after fixing tests). |
| `/contests/:id/problems/:pid/tests` | `POST` | Adds a test case (`input`, `expectedOutput`, `isSample`). |
| `/contests/:id/problems/:pid/tests/:tid` | `GET` / `PATCH` / `DELETE` | Full test contents; edit; delete. |
| `/contests/:id/problems/:pid/tests/upload` | `POST` | Multipart bulk upload: `.zip` or files paired by name (`1.in`/`1.out`, `input/1.txt`/`output/1.txt`, `input01.txt`/`output01.txt`); `mode` = `append`/`replace`; optional `sampleCount`. |
| `/contests/:id/monitor` | `GET` | Live monitor data: leaderboard, participants, latest submissions and events, judge queue. |
| `/contests/:id/participants/:uid/:action` | `POST` | `block` (optional `reason`), `unblock`, or `remove` a participant. |
| `/contests/:id/submissions/:sid/rejudge` | `POST` | Judges one submission again. |

**Participant**

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/contests/resolve/:code` | `GET` | Lobby info by code: phase (`DRAFT`/`SCHEDULED`/`LIVE`/`ENDED`), times, organizer, counts, and the caller's participant status. |
| `/contests/:id/join` | `POST` | Registers for the contest (before or during it). |
| `/contests/:id/problems` | `GET` | Problems with statements and **sample** tests only, once the contest has started. |
| `/contests/:id/open` | `POST` | Loads the caller's file for `{ problemId, language }` into their live editor document, creating it from the language template the first time. |
| `/contests/:id/run` | `POST` | Runs code on the sample tests, or with `mode: "custom"` and `stdin`. Not stored or scored. |
| `/contests/:id/submit` | `POST` | Queues a submission; it is judged on every test case. One submission at a time per participant (`429` otherwise). |
| `/contests/:id/submissions` | `GET` | The caller's submissions (optionally `?problem=`). |
| `/contests/:id/submissions/:sid` | `GET` | One submission with per-test verdicts and times (hidden tests show only the verdict), compile output, and queue position. |
| `/contests/:id/leaderboard` | `GET` | Standings: best score per problem, total, and the time the total was reached. Hidden from participants until the end when the organizer chose `AFTER_END`. |
| `/contests/:id/proctor` | `POST` | Proctoring events (`TAB_SWITCH`, `FULLSCREEN_EXIT`, `PASTE`) when the contest has proctoring on; too many tab switches block the participant. |

---
*Generated by Antigravity*
