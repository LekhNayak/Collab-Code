// MySQL compatibility for SQL problems, which run on SQLite (see sqlWorker.ts):
//  - registerMysqlFunctions: common MySQL functions SQLite lacks (LEFT, DATE_FORMAT, DATEDIFF, REGEXP, ...)
//  - mysqlSchemaToSqlite: the organizer's schema may use MySQL DDL (AUTO_INCREMENT, ENUM, ENGINE=...)
// Syntax that isn't a function call can't be added this way and still fails: DATE_ADD(d, INTERVAL 1 DAY),
// GROUP_CONCAT(x SEPARATOR ';'), a DIV b, a <=> b, @variables. 5/2 is integer division (2) in SQLite.

import type { Database, SqlValue } from 'sql.js';

type Arg = SqlValue;
type Fn = (...args: Arg[]) => SqlValue | boolean;

// Results that could grow without bound (REPEAT, LPAD, ...) stop here instead of exhausting memory
const MAX_STRING_LENGTH = 1_000_000;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const text = (value: Arg) => (value instanceof Uint8Array ? Buffer.from(value).toString('utf-8') : String(value));
const chars = (value: Arg) => Array.from(text(value)); // code points, like MySQL's character functions
const num = (value: Arg) => Number(value);
const pad2 = (n: number) => String(n).padStart(2, '0');

function checkLength(length: number) {
    if (length > MAX_STRING_LENGTH) throw new Error(`Result is longer than ${MAX_STRING_LENGTH} characters`);
}

// ─── Dates (SQLite stores them as text: 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS') ───

const DATE_RE = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.\d+)?)?)?/;

interface ParsedDate {
    date: Date; // UTC
    hasTime: boolean;
}

// MySQL returns NULL for invalid dates; so do these functions
function parseDate(value: Arg): ParsedDate | null {
    if (value === null) return null;
    const match = DATE_RE.exec(text(value));
    if (!match) return null;
    const [year, month, day, hour, minute, second] = match.slice(1).map(part => (part === undefined ? 0 : Number(part)));
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null; // e.g. Feb 30
    return { date, hasTime: match[4] !== undefined };
}

const formatDate = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const formatTime = (d: Date) => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
const formatDateTime = (d: Date) => `${formatDate(d)} ${formatTime(d)}`;

const dayOfYear = (d: Date) => Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
const ordinal = (n: number) => {
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
    return `${n}${suffix}`;
};
const hour12 = (d: Date) => d.getUTCHours() % 12 || 12;

// MySQL DATE_FORMAT specifiers (week-number ones are not supported and print the letter, like MySQL
// does for unknown specifiers)
const DATE_FORMAT: Record<string, (d: Date) => string> = {
    a: d => DAYS[d.getUTCDay()].slice(0, 3),
    b: d => MONTHS[d.getUTCMonth()].slice(0, 3),
    c: d => String(d.getUTCMonth() + 1),
    D: d => ordinal(d.getUTCDate()),
    d: d => pad2(d.getUTCDate()),
    e: d => String(d.getUTCDate()),
    f: () => '000000',
    H: d => pad2(d.getUTCHours()),
    h: d => pad2(hour12(d)),
    I: d => pad2(hour12(d)),
    i: d => pad2(d.getUTCMinutes()),
    j: d => String(dayOfYear(d)).padStart(3, '0'),
    k: d => String(d.getUTCHours()),
    l: d => String(hour12(d)),
    M: d => MONTHS[d.getUTCMonth()],
    m: d => pad2(d.getUTCMonth() + 1),
    p: d => (d.getUTCHours() < 12 ? 'AM' : 'PM'),
    r: d => `${pad2(hour12(d))}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} ${d.getUTCHours() < 12 ? 'AM' : 'PM'}`,
    S: d => pad2(d.getUTCSeconds()),
    s: d => pad2(d.getUTCSeconds()),
    T: formatTime,
    W: d => DAYS[d.getUTCDay()],
    w: d => String(d.getUTCDay()),
    Y: d => String(d.getUTCFullYear()),
    y: d => pad2(d.getUTCFullYear() % 100),
};

function dateFormat(value: Arg, format: Arg) {
    const parsed = parseDate(value);
    if (!parsed) return null;
    return text(format).replace(/%(.)/g, (_match, spec: string) => (DATE_FORMAT[spec] ? DATE_FORMAT[spec](parsed.date) : spec));
}

function addDays(value: Arg, days: Arg) {
    const parsed = parseDate(value);
    if (!parsed) return null;
    const date = new Date(parsed.date.getTime() + Math.trunc(num(days)) * 86_400_000);
    return parsed.hasTime ? formatDateTime(date) : formatDate(date);
}

const datePart = (part: (d: Date) => number) => (value: Arg) => {
    const parsed = parseDate(value);
    return parsed ? part(parsed.date) : null;
};

// ─── Strings ───────────────────────────────────────────────────────────────

function pad(value: Arg, length: Arg, padding: Arg, left: boolean) {
    const target = Math.trunc(num(length));
    if (target < 0) return null;
    checkLength(target);
    const source = chars(value);
    if (source.length >= target) return source.slice(0, target).join('');
    const fill = chars(padding);
    if (fill.length === 0) return null;
    const extra = Array.from({ length: target - source.length }, (_, i) => fill[i % fill.length]).join('');
    return left ? extra + source.join('') : source.join('') + extra;
}

function substringIndex(value: Arg, delimiter: Arg, count: Arg) {
    const delim = text(delimiter);
    const n = Math.trunc(num(count));
    if (delim === '' || n === 0) return '';
    const parts = text(value).split(delim);
    return n > 0 ? parts.slice(0, n).join(delim) : parts.slice(n).join(delim);
}

function mid(value: Arg, position: Arg, length?: Arg) {
    const source = chars(value);
    const pos = Math.trunc(num(position));
    if (pos === 0 || Math.abs(pos) > source.length) return '';
    const start = pos > 0 ? pos - 1 : source.length + pos;
    if (length === undefined) return source.slice(start).join('');
    const len = Math.trunc(num(length));
    return len <= 0 ? '' : source.slice(start, start + len).join('');
}

function locate(needle: Arg, haystack: Arg, position?: Arg) {
    const from = position === undefined ? 1 : Math.trunc(num(position));
    if (from < 1) return 0;
    return text(haystack).indexOf(text(needle), from - 1) + 1;
}

// ─── Numbers ───────────────────────────────────────────────────────────────

function truncate(value: Arg, decimals: Arg) {
    const factor = 10 ** Math.trunc(num(decimals));
    const scaled = num(value) * factor;
    // 2.3 * 10 is 22.999999999999996 in floating point; treat that as 23 before cutting
    const near = Math.round(scaled);
    return (Math.abs(scaled - near) < 1e-9 ? near : Math.trunc(scaled)) / factor;
}

// GREATEST/LEAST compare as numbers when every argument is numeric, otherwise as text (like MySQL)
function extreme(args: Arg[], pickLarger: boolean) {
    const numeric = args.every(a => typeof a === 'number' || (typeof a === 'string' && a.trim() !== '' && !Number.isNaN(Number(a))));
    return args.reduce((best, a) => {
        const larger = numeric ? num(a) > num(best) : text(a) > text(best);
        return larger === pickLarger && a !== best ? a : best;
    });
}

// ─── Regular expressions (MySQL's REGEXP is case-insensitive by default) ───

const regexCache = new Map<string, RegExp>();
function regex(pattern: Arg, flags = 'i') {
    const key = `${flags}/${text(pattern)}`;
    let compiled = regexCache.get(key);
    if (!compiled) {
        compiled = new RegExp(text(pattern), flags);
        if (regexCache.size > 200) regexCache.clear();
        regexCache.set(key, compiled);
    }
    return compiled;
}

// ─── Registration ──────────────────────────────────────────────────────────

const nullIfAnyNull = (fn: Fn): Fn => (...args) => (args.some(a => a === null) ? null : fn(...args));

// name → implementations by argument count. sql.js registers a function for exactly func.length
// arguments, so variadic MySQL functions get one entry per argument count.
const FUNCTIONS: Record<string, Partial<Record<number, Fn>>> = {};

function define(names: string | string[], arities: number | number[], fn: Fn) {
    for (const name of ([] as string[]).concat(names)) {
        FUNCTIONS[name] ??= {};
        for (const arity of ([] as number[]).concat(arities)) FUNCTIONS[name][arity] = fn;
    }
}
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

// Strings
define('left', 2, nullIfAnyNull((s, n) => chars(s).slice(0, Math.max(0, Math.trunc(num(n)))).join('')));
define('right', 2, nullIfAnyNull((s, n) => {
    const count = Math.trunc(num(n));
    return count <= 0 ? '' : chars(s).slice(-count).join('');
}));
define(['ucase'], 1, nullIfAnyNull(s => text(s).toUpperCase()));
define(['lcase'], 1, nullIfAnyNull(s => text(s).toLowerCase()));
define(['char_length', 'character_length'], 1, nullIfAnyNull(s => chars(s).length));
define('locate', [2, 3], nullIfAnyNull((needle, haystack, position) => locate(needle, haystack, position)));
define('lpad', 3, nullIfAnyNull((s, n, p) => pad(s, n, p, true)));
define('rpad', 3, nullIfAnyNull((s, n, p) => pad(s, n, p, false)));
define('repeat', 2, nullIfAnyNull((s, n) => {
    const count = Math.max(0, Math.trunc(num(n)));
    checkLength(text(s).length * count);
    return text(s).repeat(count);
}));
define('space', 1, nullIfAnyNull(n => {
    const count = Math.max(0, Math.trunc(num(n)));
    checkLength(count);
    return ' '.repeat(count);
}));
define('reverse', 1, nullIfAnyNull(s => chars(s).reverse().join('')));
define('substring_index', 3, nullIfAnyNull(substringIndex));
define('mid', [2, 3], nullIfAnyNull((s, pos, len) => mid(s, pos, len)));
define('strcmp', 2, nullIfAnyNull((a, b) => (text(a) === text(b) ? 0 : text(a) < text(b) ? -1 : 1)));
define('ascii', 1, nullIfAnyNull(s => text(s).codePointAt(0) ?? 0));
// MySQL's CONCAT is NULL when any argument is NULL (SQLite's built-in one skips NULLs)
define('concat', range(1, 12), nullIfAnyNull((...args) => {
    const result = args.map(text).join('');
    checkLength(result.length);
    return result;
}));

// Numbers
define('mod', 2, nullIfAnyNull((a, b) => (num(b) === 0 ? null : num(a) % num(b))));
define('truncate', 2, nullIfAnyNull(truncate));
define('ceiling', 1, nullIfAnyNull(x => Math.ceil(num(x))));
define('pow', 2, nullIfAnyNull((x, y) => Math.pow(num(x), num(y))));
define('greatest', range(2, 8), nullIfAnyNull((...args) => extreme(args, true)));
define('least', range(2, 8), nullIfAnyNull((...args) => extreme(args, false)));
define('rand', 0, () => Math.random());

// Dates and times (UTC, like SQLite's CURRENT_TIMESTAMP). CURRENT_DATE / CURRENT_TIME /
// CURRENT_TIMESTAMP already work without parentheses; SQLite reads those names as keywords.
define(['now', 'sysdate', 'localtime', 'localtimestamp', 'utc_timestamp'], 0, () => formatDateTime(new Date()));
define(['curdate', 'utc_date'], 0, () => formatDate(new Date()));
define(['curtime', 'utc_time'], 0, () => formatTime(new Date()));
define('year', 1, datePart(d => d.getUTCFullYear()));
define('month', 1, datePart(d => d.getUTCMonth() + 1));
define(['day', 'dayofmonth'], 1, datePart(d => d.getUTCDate()));
define('hour', 1, datePart(d => d.getUTCHours()));
define('minute', 1, datePart(d => d.getUTCMinutes()));
define('second', 1, datePart(d => d.getUTCSeconds()));
define('quarter', 1, datePart(d => Math.floor(d.getUTCMonth() / 3) + 1));
define('dayofweek', 1, datePart(d => d.getUTCDay() + 1)); // 1 = Sunday
define('weekday', 1, datePart(d => (d.getUTCDay() + 6) % 7)); // 0 = Monday
define('dayofyear', 1, datePart(dayOfYear));
define('dayname', 1, nullIfAnyNull(v => {
    const parsed = parseDate(v);
    return parsed ? DAYS[parsed.date.getUTCDay()] : null;
}));
define('monthname', 1, nullIfAnyNull(v => {
    const parsed = parseDate(v);
    return parsed ? MONTHS[parsed.date.getUTCMonth()] : null;
}));
define('last_day', 1, nullIfAnyNull(v => {
    const parsed = parseDate(v);
    return parsed ? formatDate(new Date(Date.UTC(parsed.date.getUTCFullYear(), parsed.date.getUTCMonth() + 1, 0))) : null;
}));
define('datediff', 2, nullIfAnyNull((a, b) => {
    const x = parseDate(a), y = parseDate(b);
    if (!x || !y) return null;
    const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    return Math.round((day(x.date) - day(y.date)) / 86_400_000);
}));
define('date_format', 2, nullIfAnyNull(dateFormat));
// ADDDATE(d, days) / SUBDATE(d, days): the MySQL forms that take a number of days
define('adddate', 2, nullIfAnyNull((d, days) => addDays(d, days)));
define('subdate', 2, nullIfAnyNull((d, days) => addDays(d, -num(days))));
define('unix_timestamp', [0, 1], (...args) => {
    if (args.length === 0) return Math.floor(Date.now() / 1000);
    const parsed = parseDate(args[0]);
    return parsed ? Math.floor(parsed.date.getTime() / 1000) : null;
});
define('from_unixtime', 1, nullIfAnyNull(seconds => formatDateTime(new Date(num(seconds) * 1000))));

// Regular expressions. SQLite turns "x REGEXP p" into regexp(p, x).
define('regexp', 2, nullIfAnyNull((pattern, value) => regex(pattern).test(text(value))));
define('regexp_like', [2, 3], nullIfAnyNull((value, pattern, flags) =>
    regex(pattern, flags !== undefined && text(flags).includes('c') ? '' : 'i').test(text(value))));
define('regexp_replace', 3, nullIfAnyNull((value, pattern, replacement) => text(value).replace(new RegExp(regex(pattern).source, 'gi'), text(replacement))));
define('regexp_substr', 2, nullIfAnyNull((value, pattern) => regex(pattern).exec(text(value))?.[0] ?? null));

// Function names added on top of SQLite's own (for the participants' dialect notes)
export const MYSQL_FUNCTION_NAMES = Object.keys(FUNCTIONS).map(name => name.toUpperCase()).sort();

export function registerMysqlFunctions(db: Database) {
    for (const [name, byArity] of Object.entries(FUNCTIONS)) {
        for (const [arity, fn] of Object.entries(byArity)) {
            const wrapped = (...args: Arg[]) => {
                const result = fn!(...args);
                return typeof result === 'boolean' ? (result ? 1 : 0) : result;
            };
            // sql.js registers the function for exactly `length` arguments
            Object.defineProperty(wrapped, 'length', { value: Number(arity) });
            db.create_function(name, wrapped);
        }
    }
    // SELECT 1 FROM DUAL. A temporary view, so it never shows up among the dataset's tables.
    db.exec('CREATE TEMP VIEW dual AS SELECT \'X\' AS dummy');
}

// ─── Schema: MySQL DDL → SQLite ──────────────────────────────────────────────

const TABLE_OPTION = String.raw`(?:DEFAULT\s+)?(?:ENGINE|CHARSET|CHARACTER\s+SET|COLLATE|AUTO_INCREMENT|ROW_FORMAT|COMMENT|KEY_BLOCK_SIZE|STATS_PERSISTENT)\s*=?\s*(?:'(?:[^']|'')*'|[\w-]+)`;
const QUOTED_NAME = String.raw`(?:\x60[^\x60]+\x60|"[^"]+"|\w+)`;

// Rewrites the MySQL-only parts of CREATE TABLE statements that SQLite rejects or silently gets wrong.
// Everything else (VARCHAR(50), INT UNSIGNED, DECIMAL(10,2), backticks, FOREIGN KEY, ...) SQLite already accepts.
export function mysqlSchemaToSqlite(sql: string): string {
    return sql
        // MySQL dump boilerplate SQLite has no statement for
        .replace(/^\s*#/gm, '--')
        .replace(/^\s*(?:SET\s+(?:@|(?:NAMES|FOREIGN_KEY_CHECKS|UNIQUE_CHECKS|SQL_MODE|TIME_ZONE|AUTOCOMMIT|SESSION|GLOBAL|CHARACTER_SET_\w+)\b)|(?:USE|LOCK\s+TABLES|UNLOCK\s+TABLES|CREATE\s+(?:DATABASE|SCHEMA))\b)[^;]*;/gim, '')
        // ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=5;
        .replace(new RegExp(String.raw`\)((?:\s*,?\s*${TABLE_OPTION})+)\s*(?=;|$)`, 'gi'), ')')
        // id INT NOT NULL AUTO_INCREMENT: SQLite only numbers rows automatically for an INTEGER primary key,
        // and would otherwise silently leave the id NULL
        .replace(
            new RegExp(String.raw`((?:^|[(,])\s*${QUOTED_NAME}\s+)(?:TINY|SMALL|MEDIUM|BIG)?INT(?:EGER)?(?:\s*\(\s*\d+\s*\))?(?:\s+UNSIGNED)?(?:\s+ZEROFILL)?((?:(?!AUTO_INCREMENT)[^,()])*?)\s*\bAUTO_INCREMENT\b`, 'gim'),
            '$1INTEGER$2',
        )
        .replace(new RegExp(String.raw`((?:^|[(,])\s*${QUOTED_NAME}\s+)SERIAL\b`, 'gim'), '$1INTEGER')
        .replace(/\bAUTO_INCREMENT\b/gi, '')
        // ENUM('a', 'b') and SET('a', 'b') column types
        .replace(/\b(?:ENUM|SET)\s*\(\s*'(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*\s*\)/gi, 'TEXT')
        // Index definitions inside CREATE TABLE: KEY idx (a), INDEX idx (a), UNIQUE KEY uk (a)
        .replace(new RegExp(String.raw`,\s*UNIQUE\s+(?:KEY|INDEX)\s+(?:${QUOTED_NAME}\s*)?(\([^)]*\))(?:\s+USING\s+\w+)?`, 'gi'), ', UNIQUE $1')
        .replace(new RegExp(String.raw`,\s*(?:FULLTEXT\s+|SPATIAL\s+)?(?:KEY|INDEX)\s+(?:${QUOTED_NAME}\s*)?\([^)]*\)(?:\s+USING\s+\w+)?`, 'gi'), '')
        // Column options SQLite doesn't know
        .replace(/\s+COMMENT\s+'(?:[^']|'')*'/gi, '')
        .replace(/\s+(?:CHARACTER\s+SET|CHARSET)\s+\w+/gi, '')
        .replace(/\s+COLLATE\s+(?!(?:BINARY|NOCASE|RTRIM)\b)\w+/gi, '')
        .replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\s*\(\s*\d*\s*\))?/gi, '');
}
