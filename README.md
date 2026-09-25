# Colab Code Editor

A **collaborative, in-browser code editor** with real-time multi-user editing, isolated exam rooms, GitHub authentication, code execution, and Git integration. Think of it as a lightweight, self-hosted alternative to shared coding environments — great for pair programming, remote interviews, and live coding assessments.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [How to Run](#how-to-run)
- [User Roles](#user-roles)
- [Exam Portal](#exam-portal)
- [Code Execution (Piston)](#code-execution-piston)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Real-time collaboration** — Multiple users edit the same file simultaneously (Yjs CRDT + WebSockets). Named cursor labels show exactly who is typing where.
- **Monaco Editor** — Same editor as VS Code: syntax highlighting, multi-cursor, bracket colorization, and broad language support.
- **Auto-save** — File content is automatically saved to disk 2 seconds after the last keystroke. A save-on-hide fallback fires the moment the browser tab loses focus, so no work is lost if users close without pressing Ctrl+S.
- **Session restore** — Open tabs and the active file are restored exactly as left on every page reload.
- **Workspaces** — Per-room file systems stored on disk. Create, rename, move, and delete files and folders. Full ZIP/folder upload and workspace download.
- **Exam Portal** — Role-based secure exam rooms with per-student workspace isolation, real-time proctor monitoring, anti-cheat enforcement, and a full audit log.
- **Anti-cheat** — Fullscreen enforcement with a blocking overlay, tab-switch and Alt+Tab detection (3-strike auto-block), keyboard shortcut blocking (Ctrl+W/T/N, F12, DevTools), and copy/paste size limits with server-side logging.
- **GitHub OAuth** — Sign in with GitHub; JWT-based sessions with role embedded in token.
- **Email/password auth** — Register and log in with username + email + password.
- **Code execution** — Run code in the integrated terminal via [Piston](https://github.com/engineer-man/piston). Supports Python, JavaScript/TypeScript, Java, C/C++, Go, Rust, Bash, and more.
- **Git integration** — `init`, `status`, `add`, `commit`, `push`, `pull`, branches, and remotes via [isomorphic-git](https://isomorphic-git.org/) (no system Git required).
- **GitHub Import** — Clone any public GitHub repository straight into a new collaborative workspace.
- **Terminal** — In-app terminal with `ls`, `cat`, `touch`, `mkdir`, `rm`, `mv`, `cd`, `run`, and language execution commands.
- **Extensions** — Installable editor themes and extensions stored per-session.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, React Router 7, Vite 8, Monaco Editor (`@monaco-editor/react`), Yjs (`y-monaco`, `y-websocket`), Framer Motion, Lucide React, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript, Prisma ORM, Passport (GitHub OAuth), JWT (`jsonwebtoken`), bcryptjs |
| **Real-time** | WebSockets (`ws`), `y-websocket`, Yjs CRDT |
| **Database** | PostgreSQL (hosted on [Neon](https://neon.tech/) or any Postgres provider) |
| **Queue** | BullMQ + Redis for async code execution jobs |
| **Code execution** | Piston API (self-hosted via Docker) |
| **Git** | isomorphic-git (in-process, no system Git required) |

The repo is an **npm workspaces** monorepo: `packages/client`, `packages/server`, and `packages/shared`.

---

## Prerequisites

- **Node.js** v18+ (v20+ recommended)
- **npm** v7+ (comes with Node; needed for workspaces)
- **PostgreSQL** — any recent version (14+). Can use [Neon](https://neon.tech/) free tier for cloud Postgres.
- **Redis** — required for the code execution queue (BullMQ). Run locally or via Docker.

Optional for code execution:

- **Piston** — sandboxed code execution engine, easiest to run via Docker.

> **Note on Neon free tier:** Neon auto-suspends the DB after inactivity. The first request after a cold start may time out (~30s) while it wakes up. Subsequent requests succeed normally. This is expected behavior on the free tier.

---

## Project Structure

```
Colab Code Editor/
├── package.json                   # Root workspace config
├── packages/
│   ├── client/                    # React + Vite frontend
│   │   └── src/
│   │       ├── App.tsx            # All route definitions
│   │       ├── pages/
│   │       │   ├── Hub.tsx        # Home — 4-card destination picker
│   │       │   ├── Login.tsx      # GitHub OAuth + email/password login
│   │       │   ├── Room.tsx       # Create/join a collab room (/collab)
│   │       │   ├── ExamEntry.tsx  # Student exam entry (/take-exam)
│   │       │   ├── ImportProject.tsx  # GitHub repo import (/import)
│   │       │   ├── AdminDashboard.tsx # Proctor dashboard (/admin)
│   │       │   ├── AdminMonitor.tsx   # Live exam monitor (/exam/:id/monitor)
│   │       │   └── CollabAdmin.tsx    # Collab room admin (/collab-admin/:roomId)
│   │       └── components/
│   │           ├── IDELayout.tsx  # Main IDE shell (collab + exam modes)
│   │           ├── Editor.tsx     # Monaco + Yjs binding + cursor labels
│   │           ├── Terminal.tsx   # In-app terminal + code execution
│   │           ├── FileExplorer.tsx
│   │           ├── GitPanel.tsx
│   │           ├── ExtensionPanel.tsx
│   │           └── ui/LiquidEther.tsx  # Three.js animated background
│   ├── server/                    # Express API + WebSocket server
│   │   ├── src/
│   │   │   ├── index.ts           # App entry, routes, middleware
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # requireAuth / requireRole (reads role from JWT)
│   │   │   │   └── requestLogger.ts  # Compact single-line request logger
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts        # /auth — login, register, GitHub OAuth
│   │   │   │   ├── exam.ts        # /exam — create, sessions, logs, anti-cheat events
│   │   │   │   ├── git.ts         # /git — file CRUD, Git operations
│   │   │   │   ├── sessions.ts    # /sessions — session state + extensions
│   │   │   │   └── execution.ts   # /execute — code execution (queued + direct)
│   │   │   ├── services/
│   │   │   │   ├── GitService.ts  # isomorphic-git wrapper
│   │   │   │   ├── executionService.ts  # Piston API integration
│   │   │   │   └── sessionService.ts    # Session JSON persistence
│   │   │   └── socket/index.ts    # Yjs WebSocket — collab, exam, admin-monitor modes
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── workspaces/            # Per-room file storage (created at runtime)
│   └── shared/                    # Shared TypeScript types
└── README.md
```

---

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repo-url>
   cd "Colab Code Editor"
   ```

2. **Install all dependencies** (installs all workspaces from the root):

   ```bash
   npm install
   ```

3. **Set up environment variables** (see [Environment Variables](#environment-variables)).

4. **Set up the database** (see [Database Setup](#database-setup)).

5. **Optionally start Redis and Piston** for code execution.

---

## Environment Variables

### Server (`packages/server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API server port (default: `3001`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Secret for signing JWTs — use a long random string in production |
| `GITHUB_CLIENT_ID` | For GitHub login | From [GitHub OAuth Apps](https://github.com/settings/developers) |
| `GITHUB_CLIENT_SECRET` | For GitHub login | From the same OAuth app |
| `CallbackURL` | For GitHub login | e.g. `http://localhost:3001/auth/github/callback` |
| `PISTON_URL` | No | Self-hosted Piston API base, e.g. `http://localhost:2000/api/v2`. When unset, code runs on the free [Wandbox](https://wandbox.org) API |
| `FRONTEND_URL` | In production | Frontend origin(s) allowed by CORS, comma-separated (`localhost:5173/5174` are always allowed) |
| `DATA_DIR` | No | Where workspaces, sessions and custom extensions are stored (default: inside `packages/server`) |
| `TRUST_PROXY` | No | Number of reverse-proxy hops to trust for client IPs (default: `1` in production, `0` otherwise) |

**Example `packages/server/.env`:**

```env
PORT=3001
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
CallbackURL="http://localhost:3001/auth/github/callback"
FRONTEND_URL="http://localhost:5173"
# PISTON_URL=http://localhost:2000/api/v2
```

### Client (`packages/client/.env.development` locally, Vercel env vars in production)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **Yes** | Backend API base URL e.g. `http://localhost:3001` (a bare host gets `https://`) |
| `VITE_WS_URL` | No | WebSocket URL; defaults to `VITE_API_URL` with `http(s)` → `ws(s)` |

**Example `packages/client/.env.development`:**

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

For production set `VITE_API_URL` to your server's `https://` URL; the `wss://` WebSocket URL is derived from it.

### Deploying (Vercel + Render)

The frontend is deployed on **Vercel** and the backend on **Render**.

**Backend:** `render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) that creates the API (Docker). The database is Neon Postgres, so no Render database is created.

1. Render Dashboard → **New → Blueprint** → select this repo.
2. When prompted, set `DATABASE_URL` to your Neon connection string and `FRONTEND_URL` to your Vercel URL, e.g. `https://your-app.vercel.app`. Add several comma-separated URLs to allow preview deployments too. Leave `PISTON_URL` empty to use Wandbox.

**Frontend:** in the Vercel project (root directory `packages/client`), set `VITE_API_URL` to the Render API URL, e.g. `https://colab-api.onrender.com`, then redeploy. `VITE_WS_URL` is optional because the `wss://` URL is derived automatically. Vite reads these at build time, so changing them needs a new build.

On the free plan, workspace files under `DATA_DIR` are lost whenever the API restarts or spins down, so use a paid plan with the `disk` block in `render.yaml` to keep files.

---

## Database Setup

The server uses **Prisma** with PostgreSQL.

1. Ensure PostgreSQL is running and `DATABASE_URL` in `packages/server/.env` is correct.

2. Push the schema to the database:

   ```bash
   cd packages/server
   npx prisma db push
   ```

   Or use migrations (recommended for production):

   ```bash
   cd packages/server
   npx prisma migrate dev
   ```

3. Optionally open Prisma Studio to inspect data:

   ```bash
   cd packages/server
   npx prisma studio
   ```

> **If you add fields to `schema.prisma`** (e.g. new columns on `ExamSession`), re-run `npx prisma db push` to sync the DB. Forgetting this causes `column does not exist` errors at runtime.

---

## How to Run

### Development

From the **project root:**

```bash
npm run dev
```

- **Client:** Vite dev server at **http://localhost:5173**
- **Server:** Express + WebSocket at **http://localhost:3001**

### Run client and server separately

```bash
# Terminal 1 — server
cd packages/server && npm run dev

# Terminal 2 — client
cd packages/client && npm run dev
```

### Production build

```bash
npm run build
```

Builds the client to `packages/client/dist`. Serve with any static host or reverse proxy (nginx, Caddy, etc.) and run the server with Node.

---

## User Roles

The platform uses two roles stored in the database and embedded in the JWT at login time:

| Role | Access |
|---|---|
| `STUDENT` | Default for all new registrations. Can join collab rooms, take exams, import projects. |
| `ADMIN` | Can create and delete exam rooms, access the proctor dashboard, monitor live student sessions, block/unblock/remove students. |

**Assigning ADMIN role:**

There is no self-service admin signup. To promote a user to admin, update their record directly:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

Or use Prisma Studio (`npx prisma studio` in `packages/server`).

After updating the DB, the user must **log out and log back in** to get a new JWT that includes the updated role.

> **Why log out?** The role is embedded in the JWT at login. The server reads the role from the token directly — no DB lookup per request — so a role change only takes effect when a new token is issued.

---

## Exam Portal

### For Admins (Proctors)

1. Go to **`/admin`** (Proctor Dashboard).
2. Enter an exam title and click **Create Room**. An exam code in the format `EX-XXXXXXXX` is generated.
3. Share the exam code with students.
4. Click any exam card to open the **Live Monitor** (`/exam/:id/monitor`):
   - See each student's live code in a read-only Monaco editor panel (via Yjs).
   - View real-time event logs: joins, tab switches, fullscreen exits, code executions, paste alerts.
   - **Block**, **Unblock**, or **Remove** individual students.
   - Stats bar shows total students, blocked count, tab-switch violations, and paste alerts.

### For Students

1. Go to **`/take-exam`** from the Hub.
2. Enter the exam code (`EX-XXXXXXXX`) and your display name.
3. The IDE opens in exam mode with these restrictions enforced:
   - **Fullscreen required** — exiting fullscreen shows a blocking overlay and logs the event.
   - **Tab switching blocked** — switching away triggers an overlay with violation count. 3 violations = auto-blocked.
   - **Alt+Tab detection** — `window.blur` catches focus leaving to other OS windows.
   - **Keyboard blocking** — Ctrl+W, Ctrl+T, Ctrl+N, Ctrl+Tab, F12, F11, Alt+F4, and DevTools shortcuts are intercepted.
   - **Copy/paste limits** — copying or pasting >50 characters is blocked and logged. 20–50 characters are logged silently.
4. Each student gets an **isolated workspace** (`EX-XXXXXXXX__userId`) — students cannot see each other's code.

### Room Code Format

- Collab rooms: `CR-xxxxxxxx` (lowercase random hex)
- Exam rooms: `EX-XXXXXXXX` (uppercase — always enter in uppercase)

---

## Code Execution (Piston)

Code runs on the free [Wandbox](https://wandbox.org) API by default, with no setup needed. The public emkc.org Piston API is whitelist-only.

To use your own Piston instead:

```bash
docker compose up -d piston
```

Then set `PISTON_URL=http://localhost:2000/api/v2` and install the runtimes you need in Piston.

Supported languages: `python`, `javascript` / `node`, `typescript`, `java`, `c`, `cpp`, `go`, `rust`, `bash`.

In the terminal, use:
- `run` — execute the currently open file
- `python <file>`, `node <file>`, `go <file>` etc. — execute by language

---

## Available Scripts

**Root:**

| Script | Description |
|---|---|
| `npm run dev` | Start client + server in dev mode |
| `npm run build` | Build all workspaces |

**Client (`packages/client`):**

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint |

**Server (`packages/server`):**

| Script | Description |
|---|---|
| `npm run dev` | nodemon + ts-node (restarts on changes) |
| `npm run type-check` | `tsc --noEmit` |

---

## API Overview

| Prefix | Description |
|---|---|
| `POST /auth/register` | Register with username, email, password. Returns JWT with role. |
| `POST /auth/login` | Login with email + password. Returns JWT with role. |
| `GET /auth/github` | Initiate GitHub OAuth flow. |
| `GET /auth/github/callback` | OAuth callback — redirects to frontend with JWT. |
| `GET /git/tree/:workspaceId` | Get file tree for a workspace. |
| `GET /git/file/:workspaceId/*` | Read a file. |
| `PUT /git/file/:workspaceId/*` | Write/save a file. |
| `POST /git/clone` | Clone a GitHub repo into a workspace. |
| `POST /exam/create` | Create an exam room (ADMIN only). |
| `GET /exam` | List all exams owned by current user (ADMIN only). |
| `GET /exam/:id/sessions` | Get all student sessions for an exam (ADMIN only). |
| `GET /exam/:id/logs` | Get all event logs for an exam (ADMIN only). |
| `POST /exam/:id/join` | Student joins exam — creates session and logs JOIN event. |
| `POST /exam/:id/tab-switch` | Log a tab switch; auto-blocks at 3 violations. |
| `POST /exam/:id/fullscreen-exit` | Log a fullscreen exit. |
| `POST /exam/:id/block` | Block a student (ADMIN only). |
| `POST /exam/:id/unblock` | Unblock a student and reset violation count (ADMIN only). |
| `POST /exam/:id/remove-student` | Remove student from exam (ADMIN only). |
| `GET /sessions/:id` | Get session state (open tabs, active tab, extensions). |
| `PUT /sessions/:id` | Save session state. |
| `POST /execute/run/direct` | Execute code synchronously via Piston. |

**WebSocket** — connect to `ws://localhost:3001/<roomId>?token=<jwt>`:

| Mode | Path / Params | Description |
|---|---|---|
| Collab | `/<CR-roomId>` | Shared Yjs doc — all users edit together |
| Exam student | `/<EX-roomId>` | Per-student isolated Yjs doc |
| Admin monitor | `/?mode=admin-monitor&examId=&studentId=` | Read-only view of a student's doc |

---

## Troubleshooting

**"Cannot connect to API" or CORS errors**
- Ensure the server is running on the port in `VITE_API_URL`.
- Check that CORS on the server allows `http://localhost:5173` (or your frontend origin).

**WebSocket connection fails**
- Check `VITE_WS_URL` — must point to the same server as the API.
- Ensure the server process handles both HTTP and WebSocket upgrades (they share the same port).

**Database errors on first request (Neon)**
- Neon free tier suspends after inactivity. The first request after a cold start times out while the DB wakes (~30s). Retry the request — it will succeed.

**"Column does not exist" errors (Prisma)**
- The DB schema is out of sync with `schema.prisma`. Run `npx prisma db push` in `packages/server`.

**Admin can't create exams / gets 403**
- Confirm the user's `role` is `ADMIN` in the DB.
- Log out and log back in — the role must be in the JWT, which is only issued at login.

**Exam room code "Room not found" for students**
- Exam codes are always uppercase (`EX-XXXXXXXX`). The student entry form auto-uppercases, but verify there are no extra spaces.

**Code disappears after code execution**
- Fixed in current version. The Yjs WebSocket `sync` event previously wiped the editor on every reconnect. Now the doc is only seeded when empty.

**Unsaved dot appears on reload with no changes**
- Fixed in current version. The modified indicator now compares against last-saved disk content, so the Yjs initial sync (which inserts the same bytes already on disk) no longer triggers the dot.

**GitHub login redirect or "failureRedirect"**
- Confirm `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `CallbackURL` match your [GitHub OAuth App](https://github.com/settings/developers).
- The callback URL must match exactly (e.g. `http://localhost:3001/auth/github/callback`).

**Code execution fails**
- Ensure Redis is running (`REDIS_HOST` / `REDIS_PORT` correct).
- Ensure Piston is running (`PISTON_URL` correct).
- Check server logs for Piston API errors.

---

**Built by Lekh Sanatan Nayak**
