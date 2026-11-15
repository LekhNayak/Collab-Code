import { API_BASE } from './config';
import { apiFetch } from './api';

// Collab room access: roles, join requests, removals and the comment thread (server: routes/collab.ts)

export type RoomRole = 'OWNER' | 'CO_OWNER' | 'WRITE' | 'COMMENT' | 'READ';
/** The roles an owner hands to ordinary members */
export type MemberRole = 'WRITE' | 'COMMENT' | 'READ';

export const ROLE_LABEL: Record<RoomRole, string> = {
    OWNER: 'Owner',
    CO_OWNER: 'Co-owner',
    WRITE: 'Can edit',
    COMMENT: 'Can comment',
    READ: 'Can view',
};

export const ROLE_HELP: Record<MemberRole, string> = {
    WRITE: 'Edits files and comments',
    COMMENT: 'Reads the code and leaves comments',
    READ: 'Reads the code and the comments',
};

export interface RoomMember {
    userId: string;
    username: string;
    role: RoomRole;
    status: 'PENDING' | 'ACTIVE';
    online: boolean;
}

export interface RoomState {
    roomId: string;
    defaultRole: RoomRole;
    ownerId: string;
    /** Whoever is using owner powers right now: the owner, or the first co-owner while the owner is away */
    actingOwnerId: string | null;
    me: {
        userId: string;
        status: 'NONE' | 'PENDING' | 'ACTIVE' | 'KICKED';
        role: RoomRole;
        canWrite: boolean;
        canComment: boolean;
        canManage: boolean;
    };
    members: RoomMember[];
}

export interface RoomComment {
    id: string;
    userId: string;
    username: string;
    text: string;
    createdAt: string;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await apiFetch(`${API_BASE}/collab${path}`, {
        method: init?.method ?? 'GET',
        headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data as T;
}

const room = (id: string) => `/rooms/${encodeURIComponent(id)}`;

export const createRoom = (roomId: string, defaultRole: MemberRole, name: string) =>
    call<RoomState>('/rooms', { method: 'POST', body: { roomId, defaultRole, name } });
export const joinRoom = (roomId: string, name: string) => call<RoomState>(`${room(roomId)}/join`, { method: 'POST', body: { name } });
export const setDefaultRole = (roomId: string, defaultRole: MemberRole) => call(room(roomId), { method: 'PATCH', body: { defaultRole } });
export const setMemberRole = (roomId: string, userId: string, role: MemberRole | 'CO_OWNER') =>
    call(`${room(roomId)}/members/${encodeURIComponent(userId)}/role`, { method: 'POST', body: { role } });
export const kickMember = (roomId: string, userId: string) => call(`${room(roomId)}/members/${encodeURIComponent(userId)}/kick`, { method: 'POST' });
export const approveRequest = (roomId: string, userId: string, role?: MemberRole) =>
    call(`${room(roomId)}/requests/${encodeURIComponent(userId)}/approve`, { method: 'POST', body: role ? { role } : {} });
export const approveAll = (roomId: string) => call<{ admitted: number }>(`${room(roomId)}/requests/approve-all`, { method: 'POST' });
export const rejectRequest = (roomId: string, userId: string) => call(`${room(roomId)}/requests/${encodeURIComponent(userId)}/reject`, { method: 'POST' });
export const getComments = (roomId: string) => call<RoomComment[]>(`${room(roomId)}/comments`);
export const postComment = (roomId: string, text: string) => call<RoomComment>(`${room(roomId)}/comments`, { method: 'POST', body: { text } });
export const deleteComment = (roomId: string, commentId: string) => call(`${room(roomId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
