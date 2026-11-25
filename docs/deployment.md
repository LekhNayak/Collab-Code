# Deployment

[Back to the README](../README.md)

The client is deployed on **Vercel**, the server on **Render**, and the database is **Neon** Postgres.

## Server on Render

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) that creates the API from the `Dockerfile`. It doesn't create a database.

1. In the Render dashboard, choose **New → Blueprint** and select this repository.
2. When prompted, set:
   - `DATABASE_URL`: your Neon connection string
   - `FRONTEND_URL`: your Vercel URL, such as `https://your-app.vercel.app`. Separate several with commas to allow preview deployments.
   - `PISTON_URL`: leave empty to use Wandbox

Render generates `JWT_SECRET`. The service redeploys only when `packages/server`, `packages/shared`, the `Dockerfile`, `start.sh` or `package-lock.json` changes.

## Client on Vercel

In the Vercel project, set the root directory to `packages/client` and `VITE_API_URL` to the Render API URL, such as `https://colab-api.onrender.com`. Then deploy.

`VITE_WS_URL` is optional, since the `wss://` URL is derived from it. Vite reads these variables at build time, so changing them needs a new build.

> When a release changes both sides, deploy the server first. A new client can depend on endpoints an old server doesn't have.

## What the free plan keeps

Render's free plan wipes the disk under `DATA_DIR` whenever the API restarts or spins down after 15 idle minutes.

| Data | After a restart |
|---|---|
| Workspace files, sessions, custom extensions | Restored from Postgres automatically |
| Users, rooms, exams, contests, submissions | Always in Postgres |
| Submissions being judged | Judged again |
| Git history (`.git`) | Lost. The repository keeps its files but has no commits. |
| Files over 2 MB, or beyond 20 MB or 2,000 files per workspace | Lost, they aren't copied to Postgres |

To keep git history, use a paid plan and uncomment the `disk` block in `render.yaml`.
