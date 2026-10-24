// Runs SQL problems: SQLite (sql.js, WebAssembly) in a small pool of worker threads.
//
// Every job gets a fresh in-memory database: the organizer's schema, then the test's data, then the
// participant's (or reference) query.
//  - time: the worker times the query itself; a job still running at its deadline is killed with its
//    worker (a runaway WITH RECURSIVE can't be interrupted any other way) and a new worker starts
//  - memory: SQLite's heap and the database size are capped inside the worker. WebAssembly memory
//    never shrinks, so a worker that grew past RECYCLE_AT_BYTES is replaced after its job.
//  - no file system or network: the database lives in WebAssembly memory
// Nothing here goes through Wandbox/Piston, so SQL judging doesn't share their rate limits.

import path from 'path';
import { Worker } from 'worker_threads';
import type { SqlTable } from './verdict';

const POOL_SIZE = Math.max(1, Number(process.env.SQL_WORKERS) || 2);
const RECYCLE_AT_BYTES = 96 * 1024 * 1024;
// Loading the schema and data, plus messaging, before the query's own clock starts
const SETUP_ALLOWANCE_MS = 2_000;
const DUMP_TIME_LIMIT_MS = 3_000;

export const SQL_MEMORY_LIMIT_MB = 32;
export const SQL_MAX_TIME_LIMIT_MS = 5_000;
const MAX_RESULT_ROWS = 10_000;
const MAX_RESULT_BYTES = 1024 * 1024;

export type SqlRunKind = 'ok' | 're' | 'tle' | 'mle' | 'ole' | 'setup-error' | 'ie';

export interface SqlRun {
    kind: SqlRunKind;
    table: SqlTable | null; // 'ok': the result of the last SELECT (null when the query returned none)
    timeMs: number | null;
    message?: string;       // the SQLite error, or what went wrong
}

export interface NamedSqlTable extends SqlTable {
    name: string;
    totalRows: number;
}

interface SetupPart {
    schema: string;
    data: string;
    memoryLimitMb: number;
}

// Messages to and from sqlWorker.ts
export type SqlJob = { id: number } & SetupPart & (
    | { mode: 'run'; query: string; timeLimitMs: number; maxRows: number; maxBytes: number }
    | { mode: 'dump'; maxRows: number }
);

export interface SqlJobResult {
    id: number;
    run?: SqlRun;
    tables?: NamedSqlTable[];
    external: number; // the worker's external memory, mostly WebAssembly
}

// A job before it gets its id (Omit applied to each variant of the union)
type JobInput = SqlJob extends infer J ? (J extends unknown ? Omit<J, 'id'> : never) : never;

interface Pending {
    job: JobInput;
    deadlineMs: number;
    resolve: (result: Omit<SqlJobResult, 'id' | 'external'>) => void;
}

interface PoolWorker {
    worker: Worker;
    ready: boolean;
    retired: boolean;
    error?: Error;
    current: (Pending & { id: number; timer: NodeJS.Timeout }) | null;
}

// ts-node in development, compiled JavaScript in production
const WORKER_FILE = path.join(__dirname, `sqlWorker${path.extname(__filename)}`);
const WORKER_EXEC_ARGV = WORKER_FILE.endsWith('.ts') ? ['-r', 'ts-node/register/transpile-only'] : [];

const workers: PoolWorker[] = [];
const queue: Pending[] = [];
let nextJobId = 0;

function retire(entry: PoolWorker) {
    entry.retired = true;
    const index = workers.indexOf(entry);
    if (index >= 0) workers.splice(index, 1);
    void entry.worker.terminate();
}

function spawn() {
    const entry: PoolWorker = {
        worker: new Worker(WORKER_FILE, { execArgv: WORKER_EXEC_ARGV, resourceLimits: { maxOldGenerationSizeMb: 96 } }),
        ready: false,
        retired: false,
        current: null,
    };
    entry.worker.unref();
    workers.push(entry);

    entry.worker.on('message', (message: SqlJobResult | { ready: true }) => {
        if ('ready' in message) {
            entry.ready = true;
            pump();
            return;
        }
        const current = entry.current;
        if (!current || message.id !== current.id) return;
        clearTimeout(current.timer);
        entry.current = null;
        current.resolve(message);
        if (message.external > RECYCLE_AT_BYTES || message.run?.kind === 'mle') retire(entry);
        pump();
    });
    entry.worker.on('error', err => {
        entry.error = err;
    });
    entry.worker.on('exit', () => {
        if (entry.retired) return;
        retire(entry);
        const reason = entry.error?.message ?? 'The SQL worker stopped';
        if (entry.current) {
            clearTimeout(entry.current.timer);
            const outOfMemory = (entry.error as NodeJS.ErrnoException | undefined)?.code === 'ERR_WORKER_OUT_OF_MEMORY';
            entry.current.resolve({ run: { kind: outOfMemory ? 'mle' : 'ie', table: null, timeMs: null, message: reason } });
            entry.current = null;
        } else if (!entry.ready) {
            // Never started (sql.js missing or broken): fail what's waiting instead of retrying forever
            console.error('[SQL] Worker failed to start:', reason);
            for (const pending of queue.splice(0)) {
                pending.resolve({ run: { kind: 'ie', table: null, timeMs: null, message: `The SQL engine failed to start: ${reason}` } });
            }
        }
        pump();
    });
}

function dispatch(entry: PoolWorker, pending: Pending) {
    const id = ++nextJobId;
    const timer = setTimeout(() => {
        if (entry.current?.id !== id) return;
        entry.current = null;
        retire(entry);
        pending.resolve({ run: { kind: 'tle', table: null, timeMs: null } });
        pump();
    }, pending.deadlineMs);
    entry.current = { ...pending, id, timer };
    entry.worker.postMessage({ ...pending.job, id });
}

function pump() {
    while (queue.length > 0) {
        const idle = workers.find(w => w.ready && !w.current);
        if (!idle) {
            // A new worker reports ready and pumps again
            if (workers.length < POOL_SIZE) spawn();
            return;
        }
        dispatch(idle, queue.shift()!);
    }
}

function enqueue(job: JobInput, deadlineMs: number) {
    return new Promise<Omit<SqlJobResult, 'id' | 'external'>>(resolve => {
        queue.push({ job, deadlineMs, resolve });
        pump();
    });
}

// Runs a query on a fresh database built from the schema and the data
export async function runSql(request: { schema: string; data: string; query: string; timeLimitMs: number }): Promise<SqlRun> {
    const timeLimitMs = Math.min(request.timeLimitMs, SQL_MAX_TIME_LIMIT_MS);
    const result = await enqueue({
        mode: 'run',
        schema: request.schema,
        data: request.data,
        query: request.query,
        memoryLimitMb: SQL_MEMORY_LIMIT_MB,
        timeLimitMs,
        maxRows: MAX_RESULT_ROWS,
        maxBytes: MAX_RESULT_BYTES,
    }, timeLimitMs + SETUP_ALLOWANCE_MS);
    if (result.run?.kind === 'tle' && result.run.timeMs === null) result.run.timeMs = timeLimitMs;
    return result.run ?? { kind: 'ie', table: null, timeMs: null, message: 'No result from the SQL worker' };
}

// The tables of a dataset (first rows of each), shown to participants for sample tests
export async function dumpSqlTables(request: { schema: string; data: string; maxRows: number }): Promise<NamedSqlTable[] | { error: string }> {
    const result = await enqueue({ mode: 'dump', ...request, memoryLimitMb: SQL_MEMORY_LIMIT_MB }, DUMP_TIME_LIMIT_MS + SETUP_ALLOWANCE_MS);
    if (result.tables) return result.tables;
    return { error: result.run?.kind === 'tle' ? 'Loading the data took too long' : result.run?.message ?? 'Could not load the data' };
}
