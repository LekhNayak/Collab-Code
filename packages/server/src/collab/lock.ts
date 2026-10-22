// Per-workspace mutex. Every disk/DB operation on a workspace (autosave flushes, opening a file
// into the live doc, REST file and git operations, restores) runs through it, so for example a page
// reload can't load a file from disk while the previous connection's final save is still writing.
//
// Not re-entrant: code running inside withLock must not call withLock for the same workspace.

const chains = new Map<string, Promise<unknown>>();

export function withLock<T>(ws: string, fn: () => Promise<T> | T): Promise<T> {
    const prev = chains.get(ws) ?? Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    const tail = next.catch(() => {});
    chains.set(ws, tail);
    // Drop the entry once nothing else is queued behind us
    tail.then(() => { if (chains.get(ws) === tail) chains.delete(ws); });
    return next;
}
