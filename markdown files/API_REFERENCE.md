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
| `/git/init` | `POST` | Initializes a brand new empty workspace directory for a project on the server filesystem. |
| `/git/tree/:workspaceId` | `GET` | Fetches the full directory and file tree structure of a workspace. Used to populate the IDE sidebar. |
| `/git/file/:workspaceId/:path` | `GET` | Reads the text content of a specific file. Triggered when a user clicks on a file in the IDE sidebar to open it in a tab. |
| `/git/file/:workspaceId/:path` | `PUT` | Saves/overwrites the content of an existing file. Triggered when the user presses `Ctrl+S` or auto-save runs. |
| `/git/file/:workspaceId/:path` | `POST` | Creates a new file or directory (based on an `isDirectory` flag). Used when a user right-clicks the tree and selects "New File" or "New Folder". |
| `/git/file/:workspaceId/:path` | `DELETE` | Permanently deletes a file or directory from the workspace. |
| `/git/file/:workspaceId` | `PATCH` | Renames or moves a file/folder to a new path. Used when a user uses the "Rename" functionality. |
| `/git/upload/:workspaceId` | `POST` | A multipart/form-data endpoint to bulk upload directories or `.zip` files. Extracts zip files automatically if `mode=zip`. |

---

## 🌿 3. Git Version Control APIs (`/git`)
These APIs allow the user to execute raw Git commands visually through the application.

| Endpoint | Method | Description & Use Case |
|---|---|---|
| `/git/clone` | `POST` | Clones a repository from a given URL into a fresh workspace. Used in the "Import Project" flow on the Hub. |
| `/git/repo/init/:workspaceId` | `POST` | Executes `git init` to turn a local unwatched workspace directory into a Git repository. |
| `/git/status/:workspaceId` | `GET` | Executes `git status`. Used to display changed files, staged files, branches, and remotes in the Source Control panel. |
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
| `/sessions` | `POST` | Creates a persistent "coding session" metadata record linking a user, a workspace, and a collaborative socket `roomId`. |
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
*Generated by Antigravity*
