// Pure judging rules: output comparison, per-test verdicts and scoring

import type { Verdict } from '@prisma/client';

// Lenient comparison used by most judges: ignore CRLF vs LF, trailing spaces/tabs on each line
// and trailing blank lines
export function normalizeOutput(output: string): string {
    return output
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');
}

export const outputsMatch = (actual: string, expected: string) => normalizeOutput(actual) === normalizeOutput(expected);

// Partial credit: each test case is worth the same share of the problem's points
export function scoreFor(points: number, passed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((points * passed / total) * 100) / 100;
}

// Verdict for a whole submission from its per-test verdicts
export function overallVerdict(verdicts: Verdict[]): Verdict {
    if (verdicts.length === 0) return 'IE';
    if (verdicts.every(v => v === 'AC')) return 'AC';
    if (verdicts.includes('CE')) return 'CE';
    if (verdicts.includes('AC')) return 'PARTIAL';
    return verdicts.find(v => v !== 'AC' && v !== 'SKIPPED') ?? 'WA';
}

// Keep stored outputs small; participants only ever see sample-test outputs
export const MAX_STORED_OUTPUT = 8 * 1024;

export function clip(text: string | undefined, max = MAX_STORED_OUTPUT): string {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}\n… (truncated)` : text;
}

// ─── SQL problems ────────────────────────────────────────────────────────────

export type SqlValue = string | number | null; // BLOBs arrive as X'..' literals
export interface SqlTable {
    columns: string[];
    rows: SqlValue[][];
}

const NUMBER_TOLERANCE = 1e-6; // relative, so AVG() rounding differences still match

const isNumeric = (value: SqlValue): boolean =>
    typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));

function valuesMatch(a: SqlValue, b: SqlValue): boolean {
    if (a === null || b === null) return a === b;
    // 1 matches 1.0 and '1': SQLite's types are loose, so only the value counts
    if (isNumeric(a) && isNumeric(b)) {
        const x = Number(a), y = Number(b);
        return Math.abs(x - y) <= NUMBER_TOLERANCE * Math.max(1, Math.abs(x), Math.abs(y));
    }
    return String(a) === String(b);
}

// Sort key consistent with valuesMatch (numbers rounded below the tolerance)
const sortKey = (row: SqlValue[]) => JSON.stringify(row.map(value =>
    value === null ? null : isNumeric(value) ? Math.round(Number(value) * 1e6) / 1e6 : `s${value}`));

// Compares a query result with the expected one. Column names are not compared (only how many there
// are); rows are compared as a multiset unless the problem says their order matters.
export function resultsMatch(actual: SqlTable, expected: SqlTable, orderMatters: boolean): boolean {
    if (actual.columns.length !== expected.columns.length || actual.rows.length !== expected.rows.length) return false;
    const order = (rows: SqlValue[][]) => orderMatters
        ? rows
        : rows.map(row => ({ row, key: sortKey(row) })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(r => r.row);
    const a = order(actual.rows), b = order(expected.rows);
    return a.every((row, i) => row.length === b[i].length && row.every((value, j) => valuesMatch(value, b[i][j])));
}

export const MAX_SHOWN_ROWS = 50;

// Keeps stored/sent result tables small; totalRows tells the UI how many there were
export function clipTable(table: SqlTable | null | undefined, max = MAX_SHOWN_ROWS): (SqlTable & { totalRows: number }) | null {
    if (!table) return null;
    return { columns: table.columns, rows: table.rows.slice(0, max), totalRows: table.rows.length };
}

export function parseSqlTable(json: string): SqlTable | null {
    try {
        const value = JSON.parse(json);
        return value && Array.isArray(value.columns) && Array.isArray(value.rows) ? value : null;
    } catch {
        return null;
    }
}
