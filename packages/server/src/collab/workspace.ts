// Shared helpers for routes that touch a workspace's files (git routes, contest routes)

import * as store from '../services/WorkspaceStore';
import { withLock } from './lock';

// Runs fn under the workspace lock, after restoring any persisted files missing from disk.
// Every route that touches a workspace goes through here (see lock.ts).
export function inWorkspace<T>(workspaceId: string, fn: () => Promise<T> | T): Promise<T> {
    return withLock(workspaceId, async () => {
        try {
            await store.ensureOnDisk(workspaceId);
        } catch (err) {
            // The disk copy is still usable; the restore is retried on the next request
            console.error(`[Store] Could not restore ${workspaceId} from the database:`, err);
        }
        return fn();
    });
}

// The disk is the working copy, so a failed DB write-through is logged rather than failing the request
export async function persist(workspaceId: string, write: () => Promise<unknown>) {
    try {
        await write();
    } catch (err) {
        console.error(`[Store] Failed to persist a change to ${workspaceId}:`, err);
    }
}

// Exam and contest workspaces belong to a single user (<room code>__<userId>).
// Contest workspaces are only reachable through the /contests routes, which check the contest phase.
export function canAccessWorkspace(workspaceId: string, userId: string | undefined): boolean {
    if (/^ct-/i.test(workspaceId)) return false;
    if (/^ex-/i.test(workspaceId)) return !!userId && workspaceId.endsWith(`__${userId}`);
    return true;
}
