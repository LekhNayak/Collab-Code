// Worker thread for SQL problems (see sqlRunner.ts): one job at a time, each on a fresh in-memory
// SQLite database. The main thread terminates this worker when a job runs past its deadline.

import { parentPort } from 'worker_threads';
import { performance } from 'perf_hooks';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic, SqlValue as RawValue, Statement } from 'sql.js';
import type { SqlJob, SqlJobResult, SqlRun, NamedSqlTable } from './sqlRunner';
import type { SqlTable, SqlValue } from './verdict';
import { registerMysqlFunctions, mysqlSchemaToSqlite } from './mysqlCompat';

const PAGE_SIZE = 4096;
// SQLite reports running into the caps below with these messages
const RESOURCE_ERROR = /out of memory|database or disk is full|string or blob too big|too many/i;

class LimitError extends Error {
    constructor(readonly kind: 'mle' | 'ole', message: string) {
        super(message);
    }
}

const toValue = (value: RawValue): SqlValue =>
    value instanceof Uint8Array ? `X'${Buffer.from(value).toString('hex').toUpperCase()}'` : value;

// Caps SQLite's heap and the database size (pages), so a hostile query fails fast instead of growing
// the worker's memory. Half of the budget goes to the database itself. Common MySQL functions are added.
function openDatabase(SQL: SqlJsStatic, memoryLimitMb: number): Database {
    const db = new SQL.Database();
    const bytes = memoryLimitMb * 1024 * 1024;
    db.exec(`PRAGMA hard_heap_limit = ${bytes}; PRAGMA max_page_count = ${Math.floor(bytes / 2 / PAGE_SIZE)}; PRAGMA temp_store = MEMORY;`);
    registerMysqlFunctions(db);
    return db;
}

function readRows(stmt: Statement, maxRows: number, maxBytes: number): SqlTable {
    const columns = stmt.getColumnNames();
    const rows: SqlValue[][] = [];
    let bytes = 0;
    while (stmt.step()) {
        if (columns.length === 0) continue;
        if (rows.length >= maxRows) throw new LimitError('ole', `The query returned more than ${maxRows} rows`);
        const row = stmt.get().map(toValue);
        for (const value of row) bytes += typeof value === 'string' ? value.length : 8;
        if (bytes > maxBytes) throw new LimitError('ole', `The query returned more than ${Math.round(maxBytes / 1024 / 1024)} MB of data`);
        rows.push(row);
    }
    return { columns, rows };
}

// Runs every statement; the result is the last one that returned columns (a SELECT)
function runQuery(db: Database, query: string, maxRows: number, maxBytes: number): SqlTable | null {
    let result: SqlTable | null = null;
    for (const stmt of db.iterateStatements(query)) {
        const table = readRows(stmt, maxRows, maxBytes);
        if (table.columns.length > 0) result = table;
    }
    return result;
}

function dumpTables(db: Database, maxRows: number): NamedSqlTable[] {
    const names = (db.exec("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values ?? [])
        .map(row => String(row[0]));
    return names.map(name => {
        const quoted = `"${name.replace(/"/g, '""')}"`;
        const totalRows = Number(db.exec(`SELECT count(*) FROM ${quoted}`)[0].values[0][0]);
        const stmt = db.prepare(`SELECT * FROM ${quoted} LIMIT ${maxRows}`);
        try {
            return { name, ...readRows(stmt, maxRows, Infinity), totalRows };
        } finally {
            stmt.free();
        }
    });
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function failure(err: unknown, timeMs: number | null): SqlRun {
    if (err instanceof LimitError) return { kind: err.kind, table: null, timeMs, message: err.message };
    const text = message(err);
    if (RESOURCE_ERROR.test(text)) return { kind: 'mle', table: null, timeMs, message: `Memory limit exceeded (${text})` };
    return { kind: 're', table: null, timeMs, message: text };
}

function handle(SQL: SqlJsStatic, job: SqlJob): Omit<SqlJobResult, 'id' | 'external'> {
    const db = openDatabase(SQL, job.memoryLimitMb);
    try {
        // The organizer's schema (MySQL DDL allowed) and the test's data load first; their time isn't the query's
        for (const [label, sql] of [['Schema', mysqlSchemaToSqlite(job.schema)], ['Data', job.data]] as const) {
            try {
                db.exec(sql);
            } catch (err) {
                return { run: { kind: 'setup-error', table: null, timeMs: null, message: `${label}: ${message(err)}` } };
            }
        }
        if (job.mode === 'dump') return { tables: dumpTables(db, job.maxRows) };

        const start = performance.now();
        try {
            const table = runQuery(db, job.query, job.maxRows, job.maxBytes);
            const timeMs = Math.round(performance.now() - start);
            if (timeMs > job.timeLimitMs) return { run: { kind: 'tle', table: null, timeMs } };
            return { run: { kind: 'ok', table, timeMs } };
        } catch (err) {
            return { run: failure(err, Math.round(performance.now() - start)) };
        }
    } catch (err) {
        return { run: { kind: 'ie', table: null, timeMs: null, message: message(err) } };
    } finally {
        db.close();
    }
}

initSqlJs().then(SQL => {
    parentPort!.on('message', (job: SqlJob) => {
        const result: SqlJobResult = { ...handle(SQL, job), id: job.id, external: process.memoryUsage().external };
        parentPort!.postMessage(result);
    });
    parentPort!.postMessage({ ready: true });
}).catch(err => {
    console.error('[SQL] Could not load SQLite:', err);
    process.exit(1);
});
