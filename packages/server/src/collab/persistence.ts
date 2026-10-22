// Server-side ownership of the live collaborative documents.
//
// One Y.Doc per workspace, named `ws-<workspaceId>`:
//   files: Y.Map<Y.Text>     path -> file text. Only the server adds entries (openFile), so two
//                            clients can never race to seed the same file.
//   saved: Y.Map<SavedMeta>  path -> hash + format of the last durably saved version. Clients
//                            compare it with their own text to show the "unsaved" dot.
//
// Edits are flushed to disk and then to Postgres shortly after they happen, and immediately when
// the last client disconnects or the process shuts down. All disk/DB work for a workspace runs
// under its lock (./lock.ts); functions documented as "lock held" expect the caller to hold it.

import fs from 'fs';
import path from 'path';
import * as Y from 'yjs';
import { setPersistence, docs } from 'y-websocket/bin/utils';
import { gitService } from '../services/GitService';
import * as store from '../services/WorkspaceStore';
import { withLock } from './lock';
import { cyrb53, decodeText, fromY, toY, type SavedMeta } from './text';

// Transaction origin for server-side changes that mirror the disk; they never mark files dirty
export const DISK_ORIGIN = 'disk';

const DOC_PREFIX = 'ws-';
const FLUSH_WAIT_MS = 1000;
const FLUSH_MAX_WAIT_MS = 5000;
const RETRY_MAX_MS = 30000;
// Larger files can't be opened in the editor
export const EDIT_MAX_BYTES = 5 * 1024 * 1024;

export const docNameFor = (ws: string) => DOC_PREFIX + ws;
const workspaceOf = (docName: string) => (docName.startsWith(DOC_PREFIX) ? docName.slice(DOC_PREFIX.length) : null);

const filesOf = (doc: Y.Doc) => doc.getMap<Y.Text>('files');
const savedOf = (doc: Y.Doc) => doc.getMap<SavedMeta>('saved');

interface DocState {
    ws: string;
    dirty: Set<string>;
    timer: NodeJS.Timeout | null;
    firstDirtyAt: number;
    retryMs: number;
    closed: boolean;
}
const states = new WeakMap<Y.Doc, DocState>();

const liveDoc = (ws: string): Y.Doc | undefined => docs.get(docNameFor(ws));
export const isLive = (ws: string) => docs.has(docNameFor(ws));

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function readDisk(abs: string): { text: string; meta: SavedMeta } | null {
    if (!fs.existsSync(abs)) return null;
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > EDIT_MAX_BYTES) return null;
    const str = decodeText(fs.readFileSync(abs));
    return str === null ? null : toY(str);
}

const isHighSurrogate = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLowSurrogate = (c: number) => c >= 0xdc00 && c <= 0xdfff;

// Replaces a file's text in place (keeping editor bindings alive) with a minimal prefix/suffix edit
function replaceText(doc: Y.Doc, p: string, text: string, meta: SavedMeta): void {
    const files = filesOf(doc);
    doc.transact(() => {
        const ytext = files.get(p);
        if (ytext) {
            const cur = ytext.toString();
            if (cur !== text) {
                let start = 0;
                const max = Math.min(cur.length, text.length);
                while (start < max && cur.charCodeAt(start) === text.charCodeAt(start)) start++;
                let endCur = cur.length;
                let endNew = text.length;
                while (endCur > start && endNew > start && cur.charCodeAt(endCur - 1) === text.charCodeAt(endNew - 1)) {
                    endCur--;
                    endNew--;
                }
                // Never split a surrogate pair — Yjs would replace both halves with U+FFFD
                if (start > 0 && isHighSurrogate(cur.charCodeAt(start - 1))) start--;
                if (endCur < cur.length && isLowSurrogate(cur.charCodeAt(endCur))) {
                    endCur++;
                    endNew++;
                }
                ytext.delete(start, endCur - start);
                ytext.insert(start, text.slice(start, endNew));
            }
        }
        savedOf(doc).set(p, meta);
    }, DISK_ORIGIN);
}

function scheduleFlush(doc: Y.Doc, state: DocState): void {
    if (state.closed) return;
    const now = Date.now();
    if (!state.firstDirtyAt) state.firstDirtyAt = now;
    if (state.timer) clearTimeout(state.timer);
    const wait = Math.max(0, Math.min(FLUSH_WAIT_MS, state.firstDirtyAt + FLUSH_MAX_WAIT_MS - now));
    state.timer = setTimeout(() => runFlush(doc, state), wait);
}

function runFlush(doc: Y.Doc, state: DocState): void {
    state.timer = null;
    withLock(state.ws, () => flushDoc(doc)).catch(err => console.error(`[Collab] Flush failed for ${state.ws}:`, err));
}

// Writes every dirty file of a doc to disk and the DB (lock held). Resolves to true when
// everything is durably saved; failed files stay dirty and are retried with backoff.
async function flushDoc(doc: Y.Doc): Promise<boolean> {
    const state = states.get(doc);
    if (!state || state.dirty.size === 0) return true;
    const { ws } = state;
    const paths = [...state.dirty];
    state.dirty.clear();
    state.firstDirtyAt = 0;

    try {
        await store.ensureOnDisk(ws);
    } catch (err) {
        // Disk writes below still go ahead; DB writes will fail and be retried
        console.error(`[Collab] Could not check ${ws} against the database:`, err);
    }

    const files = filesOf(doc);
    const saved = savedOf(doc);
    const failed: string[] = [];

    for (const p of paths) {
        const ytext = files.get(p);
        if (!ytext) continue; // deleted or renamed since it was edited
        let abs: string;
        try {
            abs = gitService.resolveFilePath(ws, p);
        } catch {
            continue;
        }

        const text = ytext.toString();
        const h = cyrb53(text);
        const meta = saved.get(p);
        if (meta && meta.h === h) continue; // edited back to the saved version

        const onDisk = readDisk(abs);
        if (meta && onDisk && onDisk.meta.h !== meta.h && onDisk.meta.h !== h) {
            // The file changed on disk since this doc last saved it — typically a client that was
            // offline reconnecting with old content. The disk wins.
            console.warn(`[Collab] ${ws}${p} changed on disk; replacing stale editor content`);
            replaceText(doc, p, onDisk.text, onDisk.meta);
            continue;
        }

        const format = meta ?? onDisk?.meta ?? { crlf: false, bom: false };
        const buf = Buffer.from(fromY(text, format), 'utf-8');
        try {
            if (!onDisk || onDisk.meta.h !== h) {
                fs.mkdirSync(path.dirname(abs), { recursive: true });
                fs.writeFileSync(abs, buf);
            }
            await store.upsertFile(ws, p, buf);
            doc.transact(() => saved.set(p, { h, crlf: format.crlf, bom: format.bom }), DISK_ORIGIN);
        } catch (err) {
            console.error(`[Collab] Failed to save ${ws}${p}:`, err);
            failed.push(p);
        }
    }

    if (failed.length === 0) {
        state.retryMs = FLUSH_WAIT_MS;
        return true;
    }

    failed.forEach(p => state.dirty.add(p));
    if (!state.closed) {
        if (state.timer) clearTimeout(state.timer);
        state.timer = setTimeout(() => runFlush(doc, state), state.retryMs);
        state.retryMs = Math.min(state.retryMs * 2, RETRY_MAX_MS);
    }
    return false;
}

export function initCollabPersistence(): void {
    setPersistence({
        provider: null,

        // Called synchronously by y-websocket when a doc is created; must not throw
        bindState: (docName: string, doc: Y.Doc) => {
            try {
                const ws = workspaceOf(docName);
                if (!ws) return;
                const state: DocState = { ws, dirty: new Set(), timer: null, firstDirtyAt: 0, retryMs: FLUSH_WAIT_MS, closed: false };
                states.set(doc, state);

                const files = filesOf(doc);
                files.observeDeep((events, tr) => {
                    if (tr.origin === DISK_ORIGIN) return;
                    for (const event of events) {
                        if (event.target === files) {
                            // Entries re-added by a client reconnecting with state from an earlier doc
                            event.changes.keys.forEach((change, key) => {
                                if (change.action !== 'delete') state.dirty.add(key);
                            });
                        } else if (typeof event.path[0] === 'string') {
                            state.dirty.add(event.path[0]);
                        }
                    }
                    if (state.dirty.size > 0) scheduleFlush(doc, state);
                });
            } catch (err) {
                console.error(`[Collab] Failed to set up ${docName}:`, err);
            }
        },

        // Called when the last client disconnects; y-websocket destroys the doc afterwards.
        // An unhandled rejection here would crash the process, so this never rejects.
        writeState: async (_docName: string, doc: Y.Doc) => {
            const state = states.get(doc);
            if (!state) return;
            state.closed = true;
            if (state.timer) {
                clearTimeout(state.timer);
                state.timer = null;
            }
            try {
                for (let attempt = 0; attempt < 4; attempt++) {
                    if (await withLock(state.ws, () => flushDoc(doc))) return;
                    await sleep(1000 * 2 ** attempt);
                }
                console.error(`[Collab] Gave up saving ${state.dirty.size} file(s) in ${state.ws} after the last client left`);
            } catch (err) {
                console.error(`[Collab] Final save failed for ${state.ws}:`, err);
            }
        },
    });
}

// ---- Operations used by the REST routes (lock held) ----

export type OpenResult = { ok: true } | { ok: false; status: number; error: string };

// Loads a file into the workspace's live doc, if it isn't there already
export function openFile(ws: string, filePath: string): OpenResult {
    const doc = liveDoc(ws);
    if (!doc) return { ok: false, status: 409, error: 'Not connected to this workspace yet' };
    const p = store.normalizePath(filePath);
    const files = filesOf(doc);
    if (files.has(p)) return { ok: true };

    const abs = gitService.resolveFilePath(ws, p);
    if (!fs.existsSync(abs)) return { ok: false, status: 404, error: `File not found: ${p}` };
    const stat = fs.statSync(abs);
    if (!stat.isFile()) return { ok: false, status: 400, error: `Not a file: ${p}` };
    if (stat.size > EDIT_MAX_BYTES) return { ok: false, status: 413, error: 'File is too large to open in the editor (over 5 MB)' };
    const str = decodeText(fs.readFileSync(abs));
    if (str === null) return { ok: false, status: 415, error: 'Binary or non-UTF-8 file — it can\'t be edited here' };

    const { text, meta } = toY(str);
    doc.transact(() => {
        files.set(p, new Y.Text(text));
        savedOf(doc).set(p, meta);
    }, DISK_ORIGIN);
    return { ok: true };
}

// Saves pending edits of a workspace now. Resolves to false if something couldn't be saved.
export async function flushWorkspace(ws: string): Promise<boolean> {
    const doc = liveDoc(ws);
    if (!doc) return true;
    const state = states.get(doc);
    if (state?.timer) {
        clearTimeout(state.timer);
        state.timer = null;
    }
    return flushDoc(doc);
}

// Current editor content of a file in the on-disk format, if it is open in the live doc
export function liveContent(ws: string, filePath: string): string | undefined {
    const doc = liveDoc(ws);
    if (!doc) return undefined;
    const p = store.normalizePath(filePath);
    const ytext = filesOf(doc).get(p);
    if (!ytext) return undefined;
    return fromY(ytext.toString(), savedOf(doc).get(p) ?? { crlf: false, bom: false });
}

// Removes a file (or a directory's files) from the live doc. Returns the ones that had unsaved
// edits, so a rename can carry them over. Open tabs on other clients close when their key goes.
export function detachPaths(ws: string, filePath: string): Array<{ path: string; text: string; meta?: SavedMeta }> {
    const doc = liveDoc(ws);
    if (!doc) return [];
    const prefix = store.normalizePath(filePath);
    const files = filesOf(doc);
    const saved = savedOf(doc);
    const state = states.get(doc);
    const unsaved: Array<{ path: string; text: string; meta?: SavedMeta }> = [];
    doc.transact(() => {
        for (const key of [...files.keys()]) {
            if (key !== prefix && !key.startsWith(prefix + '/')) continue;
            const text = files.get(key)!.toString();
            const meta = saved.get(key);
            if (!meta || meta.h !== cyrb53(text)) unsaved.push({ path: key, text, meta });
            files.delete(key);
            saved.delete(key);
            state?.dirty.delete(key);
        }
    }, DISK_ORIGIN);
    return unsaved;
}

// Writes detached unsaved edits to a new location after a rename/move. Returns the paths written.
export function writeDetached(ws: string, edits: ReturnType<typeof detachPaths>, fromPrefix: string, toPrefix: string): string[] {
    const from = store.normalizePath(fromPrefix);
    const to = store.normalizePath(toPrefix);
    return edits.map(e => {
        const target = to + e.path.slice(from.length);
        gitService.writeFile(ws, target, fromY(e.text, e.meta ?? { crlf: false, bom: false }));
        return target;
    });
}

// Brings open files in line with the disk after a git pull/checkout, upload or direct write.
// Only files whose disk content differs from their last saved version are touched, so edits to
// files the operation didn't change are kept.
export function reloadFromDisk(ws: string): void {
    const doc = liveDoc(ws);
    if (!doc) return;
    const files = filesOf(doc);
    const saved = savedOf(doc);
    const state = states.get(doc);
    for (const p of [...files.keys()]) {
        let abs: string;
        try {
            abs = gitService.resolveFilePath(ws, p);
        } catch {
            continue;
        }
        const onDisk = readDisk(abs);
        if (!onDisk) {
            detachPaths(ws, p);
        } else if (onDisk.meta.h !== saved.get(p)?.h) {
            replaceText(doc, p, onDisk.text, onDisk.meta);
            state?.dirty.delete(p);
        }
    }
}

// Saves every live doc; used on shutdown
export async function flushAll(): Promise<void> {
    await Promise.all([...docs.entries()].map(([name, doc]) => {
        const ws = workspaceOf(name);
        if (!ws) return undefined;
        return withLock(ws, () => flushDoc(doc)).catch(err => console.error(`[Collab] Shutdown save failed for ${ws}:`, err));
    }));
}
