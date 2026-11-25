# Setup

[Back to the README](../README.md)

- [Requirements](#requirements)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Running the app](#running-the-app)
- [Scripts](#scripts)
- [User roles](#user-roles)
- [Connecting GitHub](#connecting-github)

## Requirements

- **Node.js** 20.19 or newer, or 22.12 or newer (Vite 8 needs it)
- **npm** 7 or newer, for workspaces
- **PostgreSQL** 14 or newer. The [Neon](https://neon.tech/) free tier works.

Optional: **Piston** for sandboxed code execution, easiest to run with Docker. Without it, code runs on the free Wandbox API. See [Code execution](code-execution.md).

> Neon's free tier suspends the database after a few idle minutes. The first request after that can time out (about 30 seconds) while it wakes. Later requests are normal.

## Environment variables

### Server: `packages/server/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Secret for signing tokens. Use a long random string. |
| `PORT` | No | API port (default `3001`) |
| `FRONTEND_URL` | In production | Frontend origins allowed by CORS, comma-separated. `localhost:5173` and `5174` are always allowed. |
| `DATA_DIR` | No | Where working copies of workspaces are kept (default: inside `packages/server`). Files are also kept in Postgres and restored if this directory is wiped. |
| `TRUST_PROXY` | No | Reverse-proxy hops to trust for client IPs (default `1` in production, `0` otherwise) |
| `PISTON_URL` | No | Self-hosted Piston API base, such as `http://localhost:2000/api/v2`. When unset, code runs on Wandbox. |
| `PISTON_MAX_RUN_MS` | No | Highest per-test time limit Piston accepts. Must match `PISTON_RUN_TIMEOUT` on the Piston host (default `3000`). |
| `WANDBOX_RATE_PER_MIN` | No | Requests per minute sent to Wandbox (default `9`; the public API allows about 10 per IP) |
| `WANDBOX_OVERHEAD_MS` | No | Extra time allowed per Wandbox judge run for network and startup, on top of the time limit and a compile allowance per language (default `4000`) |
| `JUDGE_CONCURRENCY` | No | Submissions judged at once (default `2` on Wandbox, `4` on Piston) |
| `JUDGE_STOP_AFTER_TLE` | No | Skip a submission's remaining tests after a time-out (default `true` on Wandbox, `false` on Piston) |
| `SQL_WORKERS` | No | Worker threads running SQLite for SQL problems (default `2`) |
| `PERSIST_MAX_FILE_BYTES` | No | Largest file copied to Postgres (default `2097152`, 2 MB) |
| `PERSIST_MAX_WORKSPACE_BYTES` | No | Total copied to Postgres per workspace (default `20971520`, 20 MB) |
| `PERSIST_MAX_WORKSPACE_FILES` | No | Files copied to Postgres per workspace (default `2000`) |

Example:

```env
PORT=3001
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
FRONTEND_URL="http://localhost:5173"
# PISTON_URL=http://localhost:2000/api/v2
```

### Client: `packages/client/.env.development` locally, Vercel variables in production

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **Yes** | Backend base URL, such as `http://localhost:3001` (a bare host gets `https://`) |
| `VITE_WS_URL` | No | WebSocket URL. Defaults to `VITE_API_URL` with `http(s)` swapped for `ws(s)`. |

Vite reads these at build time, so changing them in production needs a new build.

## Database

The server uses **Prisma** with PostgreSQL. Push the schema from `packages/server`:

```bash
cd packages/server
npx prisma db push
```

To look through the data, run `npx prisma studio` in the same folder.

If you change `schema.prisma`, run `npx prisma db push` again, or you'll see `column does not exist` errors at runtime. In production, `start.sh` runs it on every boot and stops the deploy instead of applying a change that could lose data.

Besides users, rooms, exams and contests, the database holds the durable copy of workspace files (`Workspace`, `File`), IDE sessions (`IdeSession`) and custom extensions (`CustomExtension`). On startup the server imports any sessions and custom extensions that earlier versions left as JSON files under `DATA_DIR`.

> Give local development its own database, for example a Neon branch. Servers that share a database also share the contest judging queue, so a deployed server can pick up submissions made locally.

## Running the app

From the project root:

```bash
npm run dev
```

- **Client:** http://localhost:5173
- **Server:** http://localhost:3001 (REST and WebSocket on one port)

To run them separately:

```bash
# Terminal 1
cd packages/server && npm run dev

# Terminal 2
cd packages/client && npm run dev
```

For production, `npm run build` builds every workspace. The client goes to `packages/client/dist` and the server to `packages/server/dist`. See [Deployment](deployment.md).

## Scripts

| Where | Script | What it does |
|---|---|---|
| Root | `npm run dev` | Client and server in development mode |
| Root | `npm run build` | Builds all workspaces |
| Client | `npm run dev` | Vite dev server on port 5173 |
| Client | `npm run build` | Type-check and production build |
| Client | `npm run preview` | Serves the production build locally |
| Client | `npm run lint` | ESLint |
| Server | `npm run dev` | nodemon and ts-node, restarts on changes |
| Server | `npm run build` | Compiles TypeScript to `dist` |
| Server | `npm run type-check` | `tsc --noEmit` |

## User roles

Two account roles are stored in the database and written into the JWT at login:

| Role | Access |
|---|---|
| `STUDENT` | Default for new accounts. Collab rooms, contests, taking exams, importing projects. |
| `ADMIN` | Also creates and deletes exams, monitors them live, and blocks, unblocks or removes students. |

These are separate from the per-room roles in [collab rooms](collab-rooms.md). Contests need no account role: any registered user can organize one.

There is no self-service admin signup. To promote someone, update their row:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

They must **log out and back in** afterwards. The server reads the role from the token, not from the database, so a change only takes effect when a new token is issued.

## Connecting GitHub

Accounts use email and password. To push and pull from inside the editor, a user adds their GitHub username and a personal access token (classic, `repo` scope) when the app asks, or later from the Source control panel. Cloning a public repository needs no token.
