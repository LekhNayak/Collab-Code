// One Y.Doc + WebSocket per workspace for the whole IDE session.
//
// The doc (see packages/server/src/collab/persistence.ts) holds
//   files: path -> Y.Text   created by the server when a file is first opened
//   saved: path -> SavedMeta hash of the last version the server saved to disk and the database
// The server autosaves edits, so the client never writes file contents itself.

import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WS_BASE } from '../config';
import { openFile as apiOpenFile } from '../api';
import { cyrb53, type SavedMeta } from './hash';

export interface CollabWorkspace {
    doc: Y.Doc;
    provider: WebsocketProvider;
    files: Y.Map<Y.Text>;
    saved: Y.Map<SavedMeta>;
}

const CURSOR_COLORS = [
    '#f44747', '#dcdcaa', '#4ec9b0', '#569cd6', '#c586c0',
    '#ce9178', '#9cdcfe', '#d7ba7d', '#608b4e', '#d16969',
];

// Render's free plan can take ~a minute to wake up
const CONNECT_TIMEOUT_MS = 60000;
const OPEN_TIMEOUT_MS = 15000;

export function useCollabWorkspace(
    roomId: string | undefined,
    user: { name: string; id: string | null },
    enabled = true,
): CollabWorkspace | null {
    const [workspace, setWorkspace] = useState<CollabWorkspace | null>(null);

    useEffect(() => {
        if (!roomId || !enabled) return;
        const doc = new Y.Doc();
        const token = localStorage.getItem('token') || '';
        const provider = new WebsocketProvider(WS_BASE, roomId, doc, {
            params: token ? { token } : {},
            // Same-browser tabs would otherwise sync directly, mixing up e.g. two students' exam docs
            disableBc: true,
        });
        provider.awareness.setLocalStateField('user', {
            name: user.name,
            id: user.id,
            color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
        });
        // Publishing the connection we just opened is the point of this effect
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWorkspace({ doc, provider, files: doc.getMap('files'), saved: doc.getMap('saved') });
        console.log(`[Collab] Connecting to room: ${roomId} as ${user.name}`);

        return () => {
            provider.destroy();
            doc.destroy();
            setWorkspace(null);
        };
    }, [roomId, user.name, user.id, enabled]);

    return workspace;
}

function waitForSync(provider: WebsocketProvider): Promise<void> {
    if (provider.synced) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            provider.off('sync', onSync);
            reject(new Error('Could not connect to the collaboration server'));
        }, CONNECT_TIMEOUT_MS);
        const onSync = (isSynced: boolean) => {
            if (!isSynced) return;
            clearTimeout(timer);
            provider.off('sync', onSync);
            resolve();
        };
        provider.on('sync', onSync);
    });
}

function waitForKey<T>(map: Y.Map<T>, key: string): { promise: Promise<void>; cancel: () => void } {
    let cancel = () => {};
    const promise = new Promise<void>((resolve, reject) => {
        if (map.has(key)) return resolve();
        const timer = setTimeout(() => {
            cancel();
            reject(new Error('Timed out loading the file'));
        }, OPEN_TIMEOUT_MS);
        const onChange = () => {
            if (!map.has(key)) return;
            cancel();
            resolve();
        };
        cancel = () => {
            clearTimeout(timer);
            map.unobserve(onChange);
        };
        map.observe(onChange);
    });
    return { promise, cancel };
}

// Makes sure a file is in the shared doc. Instant if anyone already opened it this session;
// otherwise the server loads it from disk and it arrives over the WebSocket.
export async function openCollabFile(ws: CollabWorkspace, workspaceId: string, path: string): Promise<void> {
    await waitForSync(ws.provider);
    if (ws.files.has(path)) return;
    // Subscribe before asking: the update can arrive before the HTTP response
    const arrival = waitForKey(ws.files, path);
    try {
        await apiOpenFile(workspaceId, path);
    } catch (err) {
        arrival.cancel();
        throw err;
    }
    await arrival.promise;
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x));
const NONE: Set<string> = new Set();

// Paths (among `paths`) whose current text differs from what the server last saved
export function useDirtyPaths(ws: CollabWorkspace | null, paths: string[]): Set<string> {
    const [dirty, setDirty] = useState<Set<string>>(() => new Set());
    const key = paths.join('\n');

    useEffect(() => {
        if (!ws) return;
        const open = new Set(key ? key.split('\n') : []);
        let timer: ReturnType<typeof setTimeout> | null = null;

        const recompute = () => {
            timer = null;
            const next = new Set<string>();
            open.forEach(p => {
                const text = ws.files.get(p);
                const meta = ws.saved.get(p);
                if (text && meta && cyrb53(text.toString()) !== meta.h) next.add(p);
            });
            setDirty(prev => (sameSet(prev, next) ? prev : next));
        };
        const schedule = () => {
            if (!timer) timer = setTimeout(recompute, 150);
        };
        const onFilesChange: Parameters<typeof ws.files.observeDeep>[0] = (events, tr) => {
            // Show the dot right away on our own typing; the hash check confirms it shortly after
            if (tr.local) {
                const edited = events.map(e => e.path[0]).filter((p): p is string => typeof p === 'string' && open.has(p));
                if (edited.length > 0) {
                    setDirty(prev => (edited.every(p => prev.has(p)) ? prev : new Set([...prev, ...edited])));
                }
            }
            schedule();
        };

        ws.files.observeDeep(onFilesChange);
        ws.saved.observe(schedule);
        recompute();
        return () => {
            ws.files.unobserveDeep(onFilesChange);
            ws.saved.unobserve(schedule);
            if (timer) clearTimeout(timer);
        };
    }, [ws, key]);

    return ws ? dirty : NONE;
}
