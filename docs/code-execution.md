# Code execution

[Back to the README](../README.md)

Code runs on the free [Wandbox](https://wandbox.org) API by default, with nothing to set up. Wandbox allows about 10 runs per minute per IP, and every user of the server shares that, so the server paces its own requests. Runs people start go ahead of contest judging in the queue.

The public emkc.org Piston API is whitelist-only, so it isn't used.

## Using your own Piston

```bash
docker compose up -d piston
```

Set `PISTON_URL=http://localhost:2000/api/v2` in `packages/server/.env`, install the runtimes you need in Piston, and restart the server.

## Languages

`python`, `javascript` (or `node`), `typescript`, `java`, `c`, `cpp`, `go`, `rust` and `bash`.

SQL contest problems run on SQLite inside the server and use neither Wandbox nor Piston. See [SQL problems](contests.md#sql-problems).

## Terminal commands

| Command | What it does |
|---|---|
| `run` | Runs the open file |
| `python <file>`, `node <file>`, `go <file>` and so on | Runs a file with that language |
| `ls`, `cd`, `pwd`, `cat` | Look around the workspace |
| `touch`, `mkdir`, `rm`, `mv` | Change files. Needs edit access in a collab room. |
| `echo`, `lang`, `clear`, `help` | Print text, show the active language, clear the screen, list commands |
