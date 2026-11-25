# API

[Back to the README](../README.md)

Except for `/auth/register`, `/auth/login`, `/auth/guest` and `/healthz`, every request needs `Authorization: Bearer <jwt>`. Requests are rate limited, to 200 per minute per user overall and lower on expensive routes.

- [Auth](#auth)
- [Files and Git](#files-and-git)
- [Collab rooms](#collab-rooms)
- [Exams](#exams)
- [Contests](#contests)
- [Sessions and extensions](#sessions-and-extensions)
- [Code execution](#code-execution)
- [WebSocket](#websocket)

## Auth

| Endpoint | Description |
|---|---|
| `POST /auth/register` | Register with username, email and password. Returns a JWT with the role. |
| `POST /auth/login` | Log in with email and password. Returns a JWT with the role. |
| `POST /auth/guest` | Issues a guest token. The web client doesn't use it. |
| `PUT /auth/github-credentials` | Saves the GitHub username and token used for push and pull. |

## Files and Git

| Endpoint | Description |
|---|---|
| `POST /git/init` | Prepares a workspace, and adds a starter file to a brand-new one. |
| `GET /git/tree/:workspaceId` | File tree. |
| `POST /git/open/:workspaceId/*` | Loads a file into the live document. The content arrives over the WebSocket. |
| `POST /git/flush/:workspaceId` | Saves pending editor changes now (Ctrl+S). |
| `GET /git/file/:workspaceId/*` | Reads a file, with live editor content if it's open. |
| `PUT /git/file/:workspaceId/*` | Overwrites a file. Open editors update. |
| `POST /git/file/:workspaceId/*` | Creates a file or folder. |
| `PATCH /git/file/:workspaceId` | Renames or moves a file or folder. |
| `DELETE /git/file/:workspaceId/*` | Deletes a file or folder. |
| `POST /git/upload/:workspaceId` | Uploads a folder or ZIP. |
| `GET /git/download/:workspaceId` | Downloads the workspace. |
| `POST /git/clone` | Clones a GitHub repository into an empty workspace. Returns 409 if it already has files. |
| `POST /git/repo/init/:workspaceId` | Turns the workspace into a Git repository. |
| `GET /git/status/…`, `log/…`, `branches/…`, `remotes/…` | Repository state. |
| `POST /git/add/…`, `unstage/…`, `commit/…`, `checkout/…`, `branch/…`, `remote/…` | Local Git operations. |
| `POST /git/push/…`, `pull/…` | Sync with GitHub, using the saved token. |

## Collab rooms

| Endpoint | Description |
|---|---|
| `POST /collab/rooms` | Creates a room with the role newcomers get. |
| `POST /collab/rooms/:roomId/join` | Enters a room, or asks to. |
| `GET /collab/rooms/:roomId` | Your standing in the room, and its members. |
| `PATCH /collab/rooms/:roomId` | Sets the newcomers' role (owner). |
| `POST /collab/rooms/:roomId/members/:userId/role` | Changes a member's role. |
| `POST /collab/rooms/:roomId/members/:userId/kick` | Removes a member. |
| `POST /collab/rooms/:roomId/requests/:userId/approve` or `reject` | Answers a join request. |
| `POST /collab/rooms/:roomId/requests/approve-all` | Lets everyone waiting in. |
| `GET`, `POST /collab/rooms/:roomId/comments` | Reads or posts comments. |
| `DELETE /collab/rooms/:roomId/comments/:commentId` | Deletes a comment (managers). |

## Exams

| Endpoint | Who | Description |
|---|---|---|
| `POST /exam/create` | Admin | Creates an exam and its room code. |
| `GET /exam` | Admin | Exams you own. |
| `DELETE /exam/:id` | Admin | Deletes an exam. |
| `GET /exam/:id/sessions`, `GET /exam/:id/logs` | Admin | Student sessions, and the event log. |
| `POST /exam/:id/block`, `unblock`, `remove-student` | Admin | Moderates a student. Unblocking resets their count. |
| `GET /exam/resolve/:roomCode` | Anyone signed in | Exam details from a code. |
| `POST /exam/:id/join` | Student | Creates a session and logs the join. |
| `POST /exam/:id/execute` | Student | Runs code and logs it. |
| `POST /exam/:id/tab-switch` | Student | Logs a tab switch. The third blocks automatically. |
| `POST /exam/:id/fullscreen-exit`, `alert` | Student | Logs a fullscreen exit or a paste alert. |
| `POST /exam/:id/submit` | Student | Submits the exam. |

## Contests

| Endpoint | Description |
|---|---|
| `POST /contests`, `GET /contests/mine` | Creates a contest, or lists the ones you organize and joined. |
| `GET /contests/resolve/:code` | Lobby info: phase, times, your status and the server's clock. |
| `GET /contests/:id/admin`, `PATCH /contests/:id`, `POST /contests/:id/start`, `unschedule`, `end`, `DELETE /contests/:id` | Organizer: settings and schedule. |
| `/contests/:id/problems…`, `/contests/:id/problems/:pid/tests…` | Organizer: problems, test cases, bulk upload, rejudge. |
| `POST /contests/:id/join`, `GET /contests/:id/problems` | Join, and read problems with their samples once started. |
| `POST /contests/:id/open` | Opens your file for a problem and language. |
| `POST /contests/:id/run`, `POST /contests/:id/submit` | Run on samples or custom input, or submit for judging. |
| `GET /contests/:id/submissions`, `/submissions/:sid` | Your submissions, with a verdict per test. |
| `GET /contests/:id/leaderboard` | Standings. |
| `GET /contests/:id/monitor`, `POST /contests/:id/participants/:uid/block`, `unblock`, `remove` | Organizer live view and moderation. |

## Sessions and extensions

| Endpoint | Description |
|---|---|
| `GET`, `PUT /sessions/:id` | Open tabs, active tab and settings of an IDE session. |
| `POST /sessions`, `GET /sessions`, `DELETE /sessions/:id` | Creates, lists or deletes sessions. |
| `GET /sessions/extensions` | Available extensions. |
| `POST /sessions/extensions/custom`, `DELETE /sessions/extensions/custom/:id` | Adds or deletes a custom extension. |
| `POST /sessions/:id/extensions`, `DELETE /sessions/:id/extensions/:extensionId` | Installs or removes one in a session. |

## Code execution

| Endpoint | Description |
|---|---|
| `POST /execute/run/direct` | Runs code and returns the result. |
| `POST /execute/run`, `GET /execute/result/:jobId` | Runs code as a job, then fetches its result. |

## WebSocket

Connect to `ws://localhost:3001/<code>?token=<jwt>`. Each document connection joins the Yjs document `ws-<workspaceId>`. See [Editing and saving](architecture.md#editing-and-saving).

| Mode | Path or parameters | Description |
|---|---|---|
| Collab | `/<CR-code>` | The room's document. Read-only for people who can't edit. |
| Collab control | `/<CR-code>?mode=collab-control` | Presence, join requests, roles and comments as JSON messages. |
| Exam | `/<EX-code>` | The student's own document. |
| Exam monitor | `/?mode=admin-monitor&examId=&studentId=` | Read-only view of a student's document (admin). |
| Contest | `/<CT-code>` | The participant's own document. Read-only after the contest ends. |
| Contest monitor | `/?mode=contest-monitor&contestId=&participantId=` | Read-only view of a participant's document (organizer). |
