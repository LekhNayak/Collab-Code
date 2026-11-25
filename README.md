<p align="center">
  <a href="https://collabcode.lekh.online">
    <img src="docs/brag-new-version-1.jpg" alt="Colab Code. Choose your destination." width="100%">
  </a>
</p>

# Colab Code

Write code together in the browser, run judged coding contests, and hold proctored exams. One app, nothing to install.

**[Open the live app](https://collabcode.lekh.online)** · [Features](#features) · [Architecture](#architecture) · [Quick start](#quick-start) · [Documentation](#documentation)

<!-- VIDEO: edit this file on github.com and drag the 60-second video onto this line. GitHub replaces it with a link that plays inline. Then delete this comment. -->

> The backend runs on a free plan that sleeps when idle, so the first request can take up to a minute.

## Screenshots

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/collab-light.png">
  <img src="docs/screenshots/collab-dark.png" alt="A collab room. Ravi and Leo have named cursors in a Python file, the Collaborators panel shows each person's role and one pending request, and the terminal shows the program's output." width="100%">
</picture>

<p align="center"><em>A collab room: live cursors, roles, a join request, and the terminal.</em></p>

<table>
  <tr>
    <td width="50%">
      <picture>
        <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/hub-light.png">
        <img src="docs/screenshots/hub-dark.png" alt="The Hub, with cards for collaborating, contests and exams, and a list of recently opened rooms.">
      </picture>
      <p align="center"><em>The Hub</em></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/contest-arena.png" alt="A contest problem beside the editor. The submission is partially accepted: four of six tests passed, with one wrong answer and one time limit exceeded.">
      <p align="center"><em>Contest arena: a verdict for every test</em></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/screenshots/contest-monitor.png" alt="The contest organizer's monitor, with the leaderboard, two participants' code shown live, recent submissions and an activity log.">
      <p align="center"><em>Contest monitor</em></p>
    </td>
    <td width="50%">
      <img src="docs/screenshots/exam-monitor.png" alt="The exam monitor, with four students' code shown live, one of them blocked after three tab switches, and an event log.">
      <p align="center"><em>Exam monitor</em></p>
    </td>
  </tr>
</table>

## Features

**Code together**
- Everyone edits the same files live, with named cursors. Simultaneous edits merge instead of overwriting each other.
- Every room has roles: owner, co-owner, can edit, can comment, can view. Newcomers ask to join and someone lets them in.
- A comment thread for each room, and a file tree that updates for everyone at once.
- Work is saved about a second after you type. It survives reloads, server restarts and a wiped server disk.

**Run contests**
- Code problems in eight languages, and SQL problems answered with one query.
- Hidden test cases, partial credit per test, and a live leaderboard.
- Organizers watch participants' code live, and can extend, end or rejudge.

**Proctor exams**
- Each student works in an isolated workspace that other students can't see.
- Fullscreen is enforced, tab switches are counted (three and you're blocked), and large pastes are stopped and logged.
- Proctors see every student's code as it's typed, next to an event log.

**The editor**
- Monaco, the editor behind VS Code, with an in-app terminal that runs nine languages.
- Git built in: commit, branch, push and pull, without Git installed on the server. Import any public GitHub repository.
- Upload a folder or ZIP, download the whole workspace, and install editor themes.
- Light and dark themes. Audited against WCAG 2.2 AA with axe-core, plus manual keyboard and contrast checks.

## Architecture

The client is a static React app. One Node.js process serves the REST API, hosts the live documents over WebSockets, and judges contests. Postgres is the durable store; the server's disk is only a working copy.

```mermaid
flowchart LR
    subgraph browser["Browser"]
        editor["Monaco editor<br/>+ Yjs document"]
        app["React app<br/>served by Vercel"]
    end

    subgraph server["Node.js server (Render)"]
        ws["WebSocket server<br/>+ live Yjs documents"]
        rest["REST API"]
        judge["Contest judge<br/>+ SQLite workers"]
    end

    subgraph storage["Storage"]
        disk[("Disk<br/>working copy")]
        pg[("Postgres (Neon)<br/>durable store")]
    end

    subgraph services["Other services"]
        github["GitHub"]
        runner["Piston or Wandbox<br/>runs code"]
    end

    editor <-->|"edits, cursors"| ws
    app <-->|"room events"| ws
    app -->|"HTTPS + JWT"| rest

    ws -->|"autosave"| disk
    ws -->|"autosave"| pg
    rest --> disk
    rest --> pg
    rest <-->|"clone, push, pull"| github
    rest -->|"run"| runner
    judge <-->|"queue, results"| pg
    judge -->|"code tests"| runner
```

### How an edit is shared and saved

Each workspace has one Yjs document, owned by the server. Only the server loads files into it, so two people opening the same file can never duplicate its content.

```mermaid
sequenceDiagram
    autonumber
    participant A as Ava's browser
    participant S as Server
    participant R as Ravi's browser
    participant D as Disk
    participant P as Postgres

    A->>S: Open planner.py
    S->>D: Read the file
    S-->>A: Text arrives over the WebSocket
    S-->>R: Same document, same text
    A->>S: Types a change
    S-->>R: Change merged and shown live
    Note over S: Waits 1 s after the last edit, 5 s at most
    S->>D: Write the file
    S->>P: Store the durable copy
    S-->>A: New saved hash, the unsaved dot clears
    S-->>R: New saved hash
    Note over S,P: Also runs on Ctrl+S, when the last person leaves, and on shutdown
```

If Postgres can't be reached, the file stays marked unsaved and the save is retried.

### How a submission is judged

The `Submission` table is the queue, so a restart loses nothing. A judge claims a row before working on it, and anything that stops moving is put back. A problem scores points × tests passed ÷ total tests. The leaderboard takes each person's best submission per problem, and ties go to whoever got there first.

```mermaid
flowchart TB
    submit["Participant submits"] --> queued["QUEUED"]
    queued -->|"one judge claims it"| running["RUNNING"]
    running -.->|"server restarted,<br/>or silent for 2 minutes"| queued
    running -->|"code problem"| runner["Piston or Wandbox"]
    running -->|"SQL problem"| sqlite["SQLite worker<br/>fresh in-memory database"]
    runner --> verdict["Verdict for this test"]
    sqlite --> verdict
    verdict -->|"next test"| running
    verdict -->|"all tests done"| done["DONE<br/>scored"]
    verdict -.->|"runner unavailable<br/>after retries"| failed["ERROR<br/>not scored"]
```

### Who can do what in a room

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Waiting: asks to join
    Waiting --> Member: owner or co-owner accepts
    Waiting --> Removed: declined
    Member --> Removed: removed by someone above them
    Removed --> Waiting: asks again
```

| | Owner | Co-owner | Can edit | Can comment | Can view |
|---|:-:|:-:|:-:|:-:|:-:|
| See the code and comments | Yes | Yes | Yes | Yes | Yes |
| Post comments | Yes | Yes | Yes | Yes | No |
| Edit files | Yes | Yes | Yes | No | No |
| Accept requests, manage people below them | Yes | Yes | No | No | No |
| Make co-owners, set the newcomers' role | Yes | No | No | No | No |

If the owner goes offline, the earliest-promoted co-owner who is connected acts as owner until they return. The server enforces roles on both the REST API and the WebSocket, and a role change applies to the open connection right away.

## Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, React Router, Monaco Editor, Tailwind CSS, Framer Motion |
| **Real time** | Yjs (CRDT), y-websocket, WebSockets (`ws`), a custom Monaco binding |
| **Backend** | Node.js, Express, TypeScript, Prisma, JWT, bcryptjs |
| **Database** | PostgreSQL ([Neon](https://neon.tech/) in production) |
| **Running code** | [Piston](https://github.com/engineer-man/piston) (self-hosted) or [Wandbox](https://wandbox.org), and SQLite via sql.js for SQL problems |
| **Git** | [isomorphic-git](https://isomorphic-git.org/), in process |
| **Hosting** | Vercel (client), Render (server, Docker) |

The repository is an npm workspaces monorepo: `packages/client`, `packages/server` and `packages/shared`.

## Quick start

You need Node.js 20.19+ or 22.12+, and a PostgreSQL database (14+, or a free [Neon](https://neon.tech/) one).

```bash
git clone https://github.com/LekhNayak/Collab-Code.git
cd Collab-Code
npm install
```

Create `packages/server/.env`:

```env
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
JWT_SECRET="a-long-random-string"
```

The client needs no setup: `packages/client/.env.development` already points at `http://localhost:3001`.

Create the tables, then start the client and server together:

```bash
cd packages/server
npx prisma db push
cd ../..
npm run dev
```

Open http://localhost:5173 and register an account. Code runs on Wandbox until you [set up Piston](docs/code-execution.md).

## Documentation

| Guide | What's in it |
|---|---|
| [Setup](docs/setup.md) | Environment variables, database, scripts, making someone an admin |
| [Deployment](docs/deployment.md) | Vercel and Render, step by step |
| [Architecture](docs/architecture.md) | Saving and durability in detail, workspaces, project structure |
| [Collab rooms](docs/collab-rooms.md) | Roles, join requests, comments, what happens when the owner leaves |
| [Contests](docs/contests.md) | Organizing, taking part, judging, SQL problems |
| [Exams](docs/exams.md) | The proctor's view, the student's view, anti-cheat rules |
| [Code execution](docs/code-execution.md) | Wandbox, Piston, terminal commands |
| [API](docs/api.md) | REST endpoints and WebSocket modes |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and fixes |

## Good to know

- **Wandbox is rate limited.** Without Piston, the whole server gets about 10 code runs per minute. That's enough to try contests, not to host a real one.
- **Git history lives on the server's disk.** On Render's free plan that disk is wiped on restart. Files are restored from Postgres, but commits are not.
- **Give local development its own database.** Servers sharing a database also share the contest queue, so a deployed server can judge your local submissions.

---

Built by **Lekh Sanatan Nayak**
