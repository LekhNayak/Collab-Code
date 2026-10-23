// Durable copy of workspace files in Postgres.
//
// The disk under DATA_DIR stays the working copy (git, uploads and the editor all use it), but on
// hosts with an ephemeral disk (Render free plan) it disappears on every restart. Every change is
// written through to the File table, and ensureOnDisk() restores whatever is missing on first use.
// .git is not stored, so a restored workspace keeps its files but not its history.
//
// Callers hold the workspace lock (collab/lock.ts) around every function here.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../db';
import { gitService } from './GitService';

// Generated or vendored directories that are never persisted
const SKIP_DIRS = new Set(['.git', 'node_modules', '.venv', 'venv', '__pycache__', '.next']);

// Neon's free tier is ~0.5 GB, so keep each workspace small
export const MAX_FILE_BYTES = Number(process.env.PERSIST_MAX_FILE_BYTES) || 2 * 1024 * 1024;
const MAX_WORKSPACE_BYTES = Number(process.env.PERSIST_MAX_WORKSPACE_BYTES) || 20 * 1024 * 1024;
const MAX_WORKSPACE_FILES = Number(process.env.PERSIST_MAX_WORKSPACE_FILES) || 2000;

const BATCH = 50;

// "/src/a.ts" form used by the file tree, the editor and the File table
export function normalizePath(p: string): string {
    return '/' + p.replace(/\\/g, '/').replace(/^\/+/, '');
}

// Workspace ids are used as folder names; reject anything getWorkspacePath() would silently rewrite
export function isValidWorkspaceId(id: unknown): id is string {
    return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(id);
}

export function isPersistedPath(p: string): boolean {
    return !normalizePath(p).split('/').some(seg => SKIP_DIRS.has(seg));
}

const sha1 = (buf: Buffer) => crypto.createHash('sha1').update(buf).digest('hex');

// Workspaces whose disk copy was checked against the DB in this process
const checked = new Set<string>();
// Workspaces known to have a Workspace row
const rows = new Set<string>();

async function ensureRow(ws: string): Promise<void> {
    if (rows.has(ws)) return;
    await prisma.workspace.upsert({ where: { id: ws }, create: { id: ws, name: ws }, update: {} });
    rows.add(ws);
}

function hasFiles(dir: string): boolean {
    return fs.existsSync(dir) && fs.readdirSync(dir).length > 0;
}

// Restores files that exist in the DB but not on disk. Never deletes or overwrites anything.
// Runs once per workspace per process, and again whenever the workspace folder has vanished.
export async function ensureOnDisk(ws: string): Promise<void> {
    const dir = gitService.getWorkspacePath(ws);
    if (checked.has(ws) && fs.existsSync(dir)) return;

    const stored = await prisma.file.findMany({ where: { workspaceId: ws }, select: { path: true } });

    if (stored.length === 0) {
        // Nothing persisted yet: back-fill workspaces that predate persistence
        if (hasFiles(dir)) await syncDiskToDb(ws);
        checked.add(ws);
        return;
    }

    const missing = stored.map(r => r.path).filter(p => !fs.existsSync(gitService.resolveFilePath(ws, p)));
    for (let i = 0; i < missing.length; i += BATCH) {
        const chunk = await prisma.file.findMany({
            where: { workspaceId: ws, path: { in: missing.slice(i, i + BATCH) } },
            select: { path: true, data: true, content: true },
        });
        for (const f of chunk) {
            const buf = f.data ? Buffer.from(f.data) : Buffer.from(f.content ?? '', 'utf-8');
            gitService.writeFileRaw(ws, f.path, buf);
        }
    }
    if (missing.length > 0) console.log(`[Store] Restored ${missing.length} file(s) for ${ws} from the database`);
    rows.add(ws);
    checked.add(ws);
}

export async function upsertFile(ws: string, filePath: string, buf: Buffer): Promise<void> {
    const p = normalizePath(filePath);
    if (!isPersistedPath(p)) return;
    if (buf.length > MAX_FILE_BYTES) {
        // Too large to keep; drop any older copy rather than restore stale content later
        await prisma.file.deleteMany({ where: { workspaceId: ws, path: p } });
        return;
    }
    await ensureRow(ws);
    const fields = { data: buf, sha1: sha1(buf), size: buf.length };
    await prisma.file.upsert({
        where: { workspaceId_path: { workspaceId: ws, path: p } },
        create: { workspaceId: ws, path: p, name: path.posix.basename(p), type: 'FILE', ...fields },
        update: fields,
    });
}

// Removes a file, or a directory and everything under it
export async function deletePrefix(ws: string, filePath: string): Promise<void> {
    const p = normalizePath(filePath);
    await prisma.file.deleteMany({
        where: { workspaceId: ws, OR: [{ path: p }, { path: { startsWith: p + '/' } }] },
    });
}

export async function renamePrefix(ws: string, oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath);
    const to = normalizePath(newPath);
    const matches = await prisma.file.findMany({
        where: { workspaceId: ws, OR: [{ path: from }, { path: { startsWith: from + '/' } }] },
        select: { id: true, path: true },
    });
    if (matches.length === 0) return;

    await deletePrefix(ws, to); // stale rows at the destination would violate the unique index
    for (let i = 0; i < matches.length; i += BATCH) {
        await prisma.$transaction(matches.slice(i, i + BATCH).map(m => {
            const moved = to + m.path.slice(from.length);
            return prisma.file.update({
                where: { id: m.id },
                data: { path: moved, name: path.posix.basename(moved) },
            });
        }));
    }
}

interface DiskFile { path: string; abs: string; size: number }

function walk(ws: string): DiskFile[] {
    const root = gitService.getWorkspacePath(ws);
    const out: DiskFile[] = [];
    const visit = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                visit(abs);
            } else if (entry.isFile()) {
                out.push({ path: normalizePath(path.relative(root, abs)), abs, size: fs.statSync(abs).size });
            }
        }
    };
    visit(root);
    return out;
}

// Makes the DB match the disk: upserts changed files, removes rows for files that are gone.
// Used after bulk changes (clone, upload, pull, checkout). Returns the paths that were too
// large to persist.
export async function syncDiskToDb(ws: string): Promise<{ persisted: number; skipped: string[] }> {
    const skipped: string[] = [];
    const keep: DiskFile[] = [];
    let total = 0;
    for (const f of walk(ws)) {
        if (f.size > MAX_FILE_BYTES || total + f.size > MAX_WORKSPACE_BYTES || keep.length >= MAX_WORKSPACE_FILES) {
            skipped.push(f.path);
            continue;
        }
        total += f.size;
        keep.push(f);
    }

    await ensureRow(ws);
    const existing = new Map(
        (await prisma.file.findMany({ where: { workspaceId: ws }, select: { path: true, sha1: true } }))
            .map(r => [r.path, r.sha1])
    );

    const creates: any[] = [];
    const updates: Array<{ path: string; data: Buffer; sha1: string; size: number }> = [];
    for (const f of keep) {
        const buf = fs.readFileSync(f.abs);
        const hash = sha1(buf);
        if (!existing.has(f.path)) {
            creates.push({ workspaceId: ws, path: f.path, name: path.posix.basename(f.path), type: 'FILE', data: buf, sha1: hash, size: buf.length });
        } else if (existing.get(f.path) !== hash) {
            updates.push({ path: f.path, data: buf, sha1: hash, size: buf.length });
        }
    }
    const kept = new Set(keep.map(f => f.path));
    const removed = [...existing.keys()].filter(p => !kept.has(p));

    for (let i = 0; i < creates.length; i += BATCH) {
        await prisma.file.createMany({ data: creates.slice(i, i + BATCH), skipDuplicates: true });
    }
    for (let i = 0; i < updates.length; i += BATCH) {
        await prisma.$transaction(updates.slice(i, i + BATCH).map(u => prisma.file.update({
            where: { workspaceId_path: { workspaceId: ws, path: u.path } },
            data: { data: u.data, sha1: u.sha1, size: u.size },
        })));
    }
    for (let i = 0; i < removed.length; i += BATCH) {
        await prisma.file.deleteMany({ where: { workspaceId: ws, path: { in: removed.slice(i, i + BATCH) } } });
    }

    if (creates.length || updates.length || removed.length) {
        console.log(`[Store] ${ws}: +${creates.length} ~${updates.length} -${removed.length} file(s) persisted` +
            (skipped.length ? `, ${skipped.length} too large to persist` : ''));
    }
    checked.add(ws);
    return { persisted: keep.length, skipped };
}

// Deletes every workspace whose id starts with the prefix (e.g. all participants of a contest),
// from the database and from disk
export async function deleteWorkspacesWithPrefix(prefix: string): Promise<number> {
    const { count } = await prisma.workspace.deleteMany({ where: { id: { startsWith: prefix } } });
    const root = path.dirname(gitService.getWorkspacePath('x'));
    if (fs.existsSync(root)) {
        for (const name of fs.readdirSync(root)) {
            if (name.startsWith(prefix)) {
                fs.rmSync(path.join(root, name), { recursive: true, force: true });
                checked.delete(name);
                rows.delete(name);
            }
        }
    }
    return count;
}
