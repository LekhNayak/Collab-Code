// Recently opened rooms and contests, kept in this browser for the Hub's "Jump back in" strip.
// Stored per signed-in user so several accounts on one browser don't see each other's items.

import { getTokenUser } from './auth';

export type RecentKind = 'room' | 'contest';

export interface RecentItem {
    kind: RecentKind;
    id: string;      // room id (CR-…) or contest code (CT-…)
    title: string;
    at: number;      // last opened, ms since epoch
}

const MAX_ITEMS = 8;

const storageKey = () => {
    const user = getTokenUser();
    return user ? `recent-activity:${user.id}` : null;
};

export function getRecent(): RecentItem[] {
    const key = storageKey();
    if (!key) return [];
    try {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function save(items: RecentItem[]) {
    const key = storageKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_ITEMS)));
    } catch {
        // storage full or blocked: recent activity is a convenience only
    }
}

export function recordRecent(item: Omit<RecentItem, 'at'>) {
    const others = getRecent().filter(r => !(r.kind === item.kind && r.id === item.id));
    save([{ ...item, at: Date.now() }, ...others]);
}

export function removeRecent(kind: RecentKind, id: string): RecentItem[] {
    const remaining = getRecent().filter(r => !(r.kind === kind && r.id === id));
    save(remaining);
    return remaining;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(timestamp).toLocaleDateString();
}
