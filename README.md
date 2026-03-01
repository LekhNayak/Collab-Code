# Colab Code Editor

A **collaborative, in-browser code editor** with real-time multi-user editing, workspaces, GitHub authentication, code execution, and Git integration. Think of it as a lightweight, self-hosted alternative to shared coding environments—great for pair programming, teaching, or remote interviews.

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
- [Code Execution (Piston)](#code-execution-piston)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Real-time collaboration** – Multiple users edit the same file at once (powered by [Yjs](https://yjs.dev/) + WebSockets).
- **Monaco Editor** – Same editor as VS Code: syntax highlighting, multi-cursor, and language support.
- **Workspaces** – Create workspaces, manage files and folders, and share with team members (roles: Owner, Editor, Viewer).
- **Exam Portal** – Secure, role-based exam environments with isolated student workspaces, real-time proctor monitoring, logging, and automatic copy-paste cheat detection.
- **GitHub OAuth** – Sign in with your GitHub account; JWT-based sessions.
- **Code execution** – Run code in multiple languages via [Piston](https://github.com/engineer-man/piston) (optional). Supports Python, JavaScript/TypeScript, Java, C/C++, Go, Rust, Bash, and more. Uses a Redis-backed job queue (BullMQ) for async runs.
- **Git integration** – Clone repos, init, status, add, commit, push, pull, branches, and remotes (via [isomorphic-git](https://isomorphic-git.org/) on the server).
- **File system** – Create, edit, delete, rename, and move files/folders inside a workspace. File tree and tabbed editor.
- **Sessions** – Save and restore editor sessions (open tabs, active file, settings). Optional extension registry (built-in + custom extensions).
- **GitHub Import** – Clone public and private repositories straight into your IDE workspace instantly.
- **Terminal-style UI** – In-app “terminal” with commands like `ls`, `cat`, `touch`, `mkdir`, `rm` for file operations.

---

## Tech Stack

| Layer        | Technologies |
|-------------|--------------|
| **Frontend** | React 19, React Router 7, Vite 8, Monaco Editor, Yjs (y-monaco, y-websocket), Lucide React |
| **Backend**  | Node.js, Express, TypeScript, Prisma, Passport (GitHub OAuth), JWT, express-session |
| **Real-time**| WebSockets (ws), y-websocket, Yjs |
| **Database** | PostgreSQL |
| **Queue**    | BullMQ (Redis) for code execution jobs |
| **Code run**| Piston API (external service) |
| **Git**      | isomorphic-git (in-process, no system Git required) |

The repo is an **npm workspaces** monorepo: `packages/client`, `packages/server`, and `packages/shared`.

---

## Design Architecture (Neo-Brutalism)

The Colab Cloud UI heavily emphasizes a modern **Neo-Brutalist** design aesthetic. This translates to bold typography, high-contrast borders, solid drop shadows, and vivid functional colors.

- **Libraries Chosen**: `framer-motion` & `lucide-react`
- **Animation Strategy**: We rely heavily on micro-interactions. Elements have slight bounce on hover, push effects on click/tap, and we utilize Framer Motion to handle layout transitions (like moving and resizing editor tabs) flawlessly.
- **Component Primitives**: Specialized `BrutalButton`, `BrutalCard`, and `BrutalInput` wrappers enforce strict 4px borders and solid box-shadow displacements to keep the ecosystem cohesive.
- **Dynamic Adaptability**: The platform ships with `next-themes` style toggling, supporting both sleek dark mode and glaring light mode while maintaining brutalist design laws contextually.

---

## Prerequisites

- **Node.js** – v18+ (v20+ recommended). [Download](https://nodejs.org/)
- **npm** – v7+ (comes with Node; needed for workspaces).
- **PostgreSQL** – Any recent version (e.g. 14+). Used for users, workspaces, and file metadata.
- **Redis** – Required for the code execution queue (BullMQ). [Download](https://redis.io/) or use Docker.

Optional for **running code**:

- **Piston** – Code execution engine. Easiest: run via Docker (see [Code Execution (Piston)](#code-execution-piston)).

---

## Project Structure

```
Colab Code Editor/
├── package.json                 # Root workspace config (dev, build, test)
├── packages/
│   ├── client/                  # React + Vite frontend
│   │   ├── src/
│   │   │   ├── App.tsx          # Routes: /login, /auth/callback, /, /room/:roomId
│   │   │   ├── main.tsx
│   │   │   ├── pages/           # Login, Room list
│   │   │   └── components/       # IDELayout, FileExplorer, Editor, Terminal, GitPanel, etc.
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── server/                  # Express API + WebSocket
│   │   ├── src/
│   │   │   ├── index.ts         # Express app, CORS, session, routes, WebSocket
│   │   │   ├── config/          # Passport (GitHub)
│   │   │   ├── routes/          # auth, git, execution, sessions
│   │   │   ├── services/        # GitService, executionService, sessionService, etc.
│   │   │   └── socket/          # Yjs WebSocket server
│   │   ├── prisma/
│   │   │   └── schema.prisma    # User, Workspace, WorkspaceMember, File
│   │   └── package.json
│   └── shared/                  # Shared TypeScript types (User, Workspace)
│       └── src/index.ts
├── markdown files/              # Documentation and reports
│   ├── API_REFERENCE.md
│   ├── SECURITY_HARDENING_REPORT.md
│   ├── SOURCE_CONTROL_GUIDE.md
│   └── bug_log.md
├── README.md
└── .env files (see below)
```

---

## Installation

1. **Clone the repository** (or unzip the project):

   ```bash
   cd "c:\Users\Nayak\Desktop\Colab Code Editor"
   ```

2. **Install dependencies** (from repo root; this installs all workspaces):

   ```bash
   npm install
   ```

3. **Set up environment variables** for client and server (see [Environment Variables](#environment-variables)).

4. **Set up the database** (see [Database Setup](#database-setup)).

5. **Optional:** Start Redis and Piston if you want code execution (see [Code Execution (Piston)](#code-execution-piston)).

---

## Environment Variables

### Server (`packages/server/.env`)

Create or edit `packages/server/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API server port (default: `3001`). |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string, e.g. `postgresql://USER:PASSWORD@localhost:5432/DBNAME?schema=public`. |
| `JWT_SECRET` | **Yes** | Secret used to sign JWTs (use a long random string in production). |
| `GITHUB_CLIENT_ID` | For GitHub login | From [GitHub OAuth App](https://github.com/settings/developers). |
| `GITHUB_CLIENT_SECRET` | For GitHub login | From the same OAuth app. |
| `CallbackURL` | For GitHub login | Callback URL, e.g. `http://localhost:3001/auth/github/callback`. |
| `REDIS_HOST` | For code execution | Redis host (default: `localhost`). |
| `REDIS_PORT` | For code execution | Redis port (default: `6379`). |
| `PISTON_URL` | For code execution | Piston API base URL (default: `http://localhost:2000`). |

**Example `.env` (minimal for local dev):**

```env
PORT=3001
DATABASE_URL="postgresql://admin:password@localhost:5433/collaborative_ide?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
CallbackURL="http://localhost:3001/auth/github/callback"
REDIS_HOST=localhost
REDIS_PORT=6379
PISTON_URL=http://localhost:2000
```

### Client (`packages/client/.env`)

Create or edit `packages/client/.env`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | **Yes** | Backend API base URL (e.g. `http://localhost:3001`). |
| `VITE_WS_URL` | **Yes** | WebSocket URL for real-time collaboration (e.g. `ws://localhost:3001`). |

**Example:**

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

For production, replace `localhost` with your server hostname and use `wss://` for WebSockets if you use HTTPS.

---

## Database Setup

The server uses **Prisma** with PostgreSQL.

1. Ensure PostgreSQL is running and `DATABASE_URL` in `packages/server/.env` is correct.

2. Generate the Prisma client and run migrations:

   ```bash
   cd packages/server
   npx prisma generate
   npx prisma migrate dev
   ```

   Or from the repo root:

   ```bash
   npm run dev --workspace=@collaborative-ide/server
   ```

   You only need to run migrations once (or when schema changes). If you prefer to push the schema without migration history:

   ```bash
   cd packages/server
   npx prisma db push
   ```

3. (Optional) Open Prisma Studio to inspect data:

   ```bash
   cd packages/server
   npx prisma studio
   ```

---

## How to Run

### Development (recommended)

From the **project root**:

```bash
npm run dev
```

This runs both the client and server in development mode:

- **Client:** Vite dev server at **http://localhost:5173**
- **Server:** Express + WebSocket at **http://localhost:3001**

Open [http://localhost:5173](http://localhost:5173) in your browser. Log in with GitHub (if configured), then create or open a room to use the collaborative editor.

### Run client and server separately

**Terminal 1 – server:**

```bash
cd packages/server
npm run dev
```

**Terminal 2 – client:**

```bash
cd packages/client
npm run dev
```

Again: client at **http://localhost:5173**, API at **http://localhost:3001**. Ensure `.env` in both packages is set (especially `VITE_API_URL` and `VITE_WS_URL` for the client).

### Production build

From the project root:

```bash
npm run build
```

This builds the client (and any other workspaces that define a `build` script). Serve the client build (e.g. `packages/client/dist`) with a static file server or reverse proxy, and run the server with Node in production (e.g. `node` with compiled JS or `ts-node`/compiled TS).

---

## Exam Portal 

The platform supports a secure, role-based exam feature that integrates seamlessly with real-time collaboration endpoints without disrupting regular usage:

1. **Admin/Teacher Dashboard (`/admin`)**: 
   - Deploy new exam rooms with custom URLs.
   - Access the **Live Monitoring Suite** (`/exam/:id/monitor`) which acts as an operational command center.
2. **Student Portal (`/e/:examId`)**:
   - WebSockets automatically connect to an isolated student-specific namespace.
   - Built-in **anti-cheating mechanisms** intercept any mass copy-pasting. 
3. **Audit Log System**:
   - All code compilations, success/failure statuses, exit codes, and mass-paste events are actively broadcasted and permanently logged against the student's ID via the Prisma backend APIs.

---

## Code Execution (Piston)

Code execution is optional. If you skip it, the “Run” feature in the IDE will not work until Piston (and optionally Redis) is set up.

1. **Redis** – Required for the execution queue (BullMQ). Start Redis locally or set `REDIS_HOST` / `REDIS_PORT` in `packages/server/.env`.

   Example with Docker:

   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Piston** – Run the [Piston](https://github.com/engineer-man/piston) API (default port 2000). Example with Docker:

   ```bash
   docker run -d -p 2000:2000 ghcr.io/engineer-man/piston
   ```

   If Piston runs elsewhere, set `PISTON_URL` in `packages/server/.env` to that base URL.

Supported languages (by alias) include: `python`, `py`, `javascript`, `js`, `node`, `typescript`, `ts`, `java`, `c`, `cpp`, `c++`, `go`, `rust`, `bash`, `shell`. The server maps these to Piston runtime names and versions.

---

## Available Scripts

From the **root** `package.json`:

| Script | Description |
|--------|-------------|
| `npm run dev` | Run all workspaces in dev mode (client + server). |
| `npm run build` | Build all workspaces that define a `build` script (e.g. client). |
| `npm run test` | Run tests in all workspaces (if defined). |

**Client** (`packages/client`):

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (default port 5173). |
| `npm run build` | TypeScript build + Vite production build. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |

**Server** (`packages/server`):

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with nodemon + ts-node (restarts on file changes). |
| `npm run type-check` | Run `tsc --noEmit`. |

---

## API Overview

- **`/auth`** – GitHub OAuth: `GET /auth/github`, `GET /auth/github/callback`, `GET /auth/me`.
- **`/git`** – File and Git operations: clone, init, file CRUD, tree, and Git actions (status, add, commit, push, pull, branches, remotes, etc.).
- **`/execute`** – Code execution: `POST /execute/run` (queued), `POST /execute/run/direct` (sync), `GET /execute/result/:jobId`.
- **`/sessions`** – Sessions CRUD and extension registry: create/list/get/update/delete sessions, install/uninstall extensions, list extensions by category.
- **`/exam`** – Exam Portal APIs: Room creation, secure log fetching, execution, and copy-paste alerts.

WebSocket connections (e.g. `ws://localhost:3001/<roomId>`) are used for Yjs-based real-time collaboration; the path segment is the document/room ID.

---

## Troubleshooting

- **“Cannot connect to API” or CORS errors**  
  - Ensure the server is running on the port in `VITE_API_URL`.  
  - In dev, the client often proxies `/api` and `/auth` to the server (see `packages/client/vite.config.ts`). If you use full URLs, ensure CORS on the server allows your client origin (e.g. `http://localhost:5173`).

- **WebSocket connection fails**  
  - Check `VITE_WS_URL` (e.g. `ws://localhost:3001`).  
  - Ensure the same server process that serves the HTTP API also handles WebSocket upgrades (as in `packages/server/src/index.ts`).

- **Database connection errors**  
  - Verify PostgreSQL is running and `DATABASE_URL` is correct.  
  - Run `npx prisma generate` and `npx prisma migrate dev` in `packages/server`.

- **GitHub login redirect or “failureRedirect”**  
  - Confirm `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `CallbackURL` match your [GitHub OAuth App](https://github.com/settings/developers) settings.  
  - Callback URL must be exactly what GitHub has (e.g. `http://localhost:3001/auth/github/callback`).

- **Code execution fails or “Job not found”**  
  - Ensure Redis is running and `REDIS_HOST`/`REDIS_PORT` are correct.  
  - Ensure Piston is running and `PISTON_URL` is correct.  
  - Check server logs for BullMQ worker and Piston API errors.

- **Passport or “Strategy not found”**  
  - The server uses `passport-github2` and `jsonwebtoken`; they may be hoisted to the root `node_modules`. If you only install in `packages/server`, add `passport`, `passport-github2`, and `jsonwebtoken` to `packages/server/package.json` dependencies and run `npm install` from the root.

---

## License

See the repository for license information (if any). Otherwise, use at your own discretion.

---

**Enjoy building and collaborating with Colab Code Editor.**
