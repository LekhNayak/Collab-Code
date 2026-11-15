// Access control for collaborative rooms (CR-xxxxxxxx).
//
// Roles, highest first: OWNER > CO_OWNER > WRITE > COMMENT > READ.
//   READ      sees the code and the comments
//   COMMENT   also posts comments
//   WRITE     also edits files
//   CO_OWNER  also admits, removes and re-roles people below them, and deletes their comments
//   OWNER     also makes co-owners and sets the role newcomers get
//
// Whoever is *acting* as owner holds OWNER powers: the real owner while they are connected, otherwise the earliest
// co-owner who is. Nothing is rewritten when that changes, so the owner is the owner again the moment they return.
// With no owner and no co-owner connected the room is simply unmanaged: people already in keep their roles, requests
// wait, and nobody can promote anyone until the owner comes back.
//
// Presence comes from the "control" WebSocket each client keeps open (socket/index.ts). Yjs document sockets are
// registered here too so a role change or a removal takes effect on the live connection.

import type { WebSocket } from 'ws';
import type { CollabComment, CollabMember, CollabRole, CollabRoom } from '@prisma/client';
import prisma from '../db';

export const RANK: Record<CollabRole, number> = { READ: 0, COMMENT: 1, WRITE: 2, CO_OWNER: 3, OWNER: 4 };
/** The roles an owner can hand to ordinary members (co-owner is a separate, owner-only step) */
export const MEMBER_ROLES: CollabRole[] = ['READ', 'COMMENT', 'WRITE'];

// A page refresh drops the owner's socket for a moment; don't hand the room over for that
const OWNER_GRACE_MS = 8000;
const MAX_COMMENT_LENGTH = 2000;
const COMMENT_HISTORY = 200;
const CLOSE_REMOVED = 4003;

export class AccessError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

type RoomWithMembers = CollabRoom & { members: CollabMember[] };

// ── Live connections ────────────────────────────────────────────────────────

interface Conn {
    ws: WebSocket;
    userId: string;
}

const controls = new Map<string, Set<Conn>>(); // room -> control sockets (presence + live updates)
const docSockets = new Map<string, Set<Conn>>(); // room -> Yjs sockets (read-only flag lives on the socket)
const offlineSince = new Map<string, number>(); // `${room}:${user}` -> when their last control socket closed

const presenceKey = (roomId: string, userId: string) => `${roomId}:${userId}`;

function isOnline(roomId: string, userId: string): boolean {
    for (const conn of controls.get(roomId) ?? []) if (conn.userId === userId) return true;
    return false;
}

function isPresent(roomId: string, userId: string): boolean {
    if (isOnline(roomId, userId)) return true;
    const since = offlineSince.get(presenceKey(roomId, userId));
    return since !== undefined && Date.now() - since < OWNER_GRACE_MS;
}

// ── Who holds which powers ──────────────────────────────────────────────────

/** The person using OWNER powers right now, or null when neither the owner nor any co-owner is connected */
export function actingOwnerId(room: RoomWithMembers): string | null {
    if (isPresent(room.id, room.ownerId)) return room.ownerId;
    const coOwners = room.members
        .filter(m => m.status === 'ACTIVE' && m.role === 'CO_OWNER')
        .sort((a, b) => (a.coOwnerSince?.getTime() ?? Infinity) - (b.coOwnerSince?.getTime() ?? Infinity));
    return coOwners.find(m => isPresent(room.id, m.userId))?.userId ?? null;
}

/** The role someone can act with, or null if they are not (or no longer) in the room */
export function effectiveRole(room: RoomWithMembers, userId: string): CollabRole | null {
    const member = room.members.find(m => m.userId === userId);
    if (!member || member.status !== 'ACTIVE') return null;
    if (userId === room.ownerId || userId === actingOwnerId(room)) return 'OWNER';
    return member.role;
}

const rankOf = (role: CollabRole | null) => (role ? RANK[role] : -1);

// ── Loading ─────────────────────────────────────────────────────────────────

async function loadRoom(roomId: string): Promise<RoomWithMembers | null> {
    return prisma.collabRoom.findUnique({ where: { id: roomId }, include: { members: true } });
}

async function mustLoad(roomId: string): Promise<RoomWithMembers> {
    const room = await loadRoom(roomId);
    if (!room) throw new AccessError(404, 'Room not found');
    return room;
}

const cleanName = (name: unknown, fallback: string) => {
    const value = typeof name === 'string' ? name.trim().slice(0, 40) : '';
    return value || fallback;
};

// ── What each client is told ────────────────────────────────────────────────

export interface RoomStateMember {
    userId: string;
    username: string;
    role: CollabRole;
    status: 'PENDING' | 'ACTIVE';
    online: boolean;
}

export interface RoomState {
    roomId: string;
    defaultRole: CollabRole;
    ownerId: string;
    actingOwnerId: string | null;
    me: {
        userId: string;
        status: 'NONE' | 'PENDING' | 'ACTIVE' | 'KICKED';
        role: CollabRole;
        canWrite: boolean;
        canComment: boolean;
        canManage: boolean;
    };
    members: RoomStateMember[];
}

export function buildState(room: RoomWithMembers, userId: string): RoomState {
    const me = room.members.find(m => m.userId === userId);
    const effective = effectiveRole(room, userId);
    const rank = rankOf(effective);
    const canManage = rank >= RANK.CO_OWNER;
    return {
        roomId: room.id,
        defaultRole: room.defaultRole,
        ownerId: room.ownerId,
        actingOwnerId: actingOwnerId(room),
        me: {
            userId,
            status: me?.status ?? 'NONE',
            role: effective ?? me?.role ?? 'READ',
            canWrite: rank >= RANK.WRITE,
            canComment: rank >= RANK.COMMENT,
            canManage,
        },
        // Only people already inside see who is here; only those who can admit see who is waiting
        members: me?.status === 'ACTIVE'
            ? room.members
                .filter(m => m.status === 'ACTIVE' || (canManage && m.status === 'PENDING'))
                .map(m => ({
                    userId: m.userId,
                    username: m.username,
                    role: m.role,
                    status: m.status as 'PENDING' | 'ACTIVE',
                    online: isOnline(room.id, m.userId),
                }))
            : [],
    };
}

export async function stateFor(roomId: string, userId: string): Promise<RoomState | null> {
    const room = await loadRoom(roomId);
    return room ? buildState(room, userId) : null;
}

const send = (ws: WebSocket, message: unknown) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(message));
};

/** Makes every live connection match the stored roles, then tells every client the new picture */
export async function refresh(roomId: string): Promise<void> {
    const room = await loadRoom(roomId);
    if (!room) return;

    for (const conn of docSockets.get(roomId) ?? []) {
        const role = effectiveRole(room, conn.userId);
        if (!role) {
            conn.ws.close(CLOSE_REMOVED, 'removed');
            continue;
        }
        (conn.ws as any).readOnly = RANK[role] < RANK.WRITE;
    }
    for (const conn of controls.get(roomId) ?? []) send(conn.ws, { type: 'state', state: buildState(room, conn.userId) });
}

function sendToUser(roomId: string, userId: string, message: unknown) {
    for (const conn of controls.get(roomId) ?? []) if (conn.userId === userId) send(conn.ws, message);
}

async function sendToMembers(roomId: string, message: unknown) {
    const active = new Set(
        (await prisma.collabMember.findMany({ where: { roomId, status: 'ACTIVE' }, select: { userId: true } })).map(m => m.userId),
    );
    for (const conn of controls.get(roomId) ?? []) if (active.has(conn.userId)) send(conn.ws, message);
}

// ── Sockets ─────────────────────────────────────────────────────────────────

export function attachControl(ws: WebSocket, roomId: string, userId: string) {
    const conn: Conn = { ws, userId };
    let set = controls.get(roomId);
    if (!set) controls.set(roomId, (set = new Set()));
    set.add(conn);
    offlineSince.delete(presenceKey(roomId, userId));

    ws.on('close', () => {
        set!.delete(conn);
        if (set!.size === 0) controls.delete(roomId);
        if (isOnline(roomId, userId)) return;
        offlineSince.set(presenceKey(roomId, userId), Date.now());
        void refresh(roomId); // shows them offline right away
        // ...and again once the grace period is over, in case that hands the room to a co-owner
        setTimeout(() => void refresh(roomId), OWNER_GRACE_MS + 100).unref();
    });
    ws.on('error', () => {});

    void refresh(roomId);
}

/** Registers a Yjs document socket so role changes and removals reach it. `readOnly` is read on every message. */
export function attachDocSocket(ws: WebSocket, roomId: string, userId: string, readOnly: boolean) {
    (ws as any).readOnly = readOnly;
    const conn: Conn = { ws, userId };
    let set = docSockets.get(roomId);
    if (!set) docSockets.set(roomId, (set = new Set()));
    set.add(conn);
    ws.on('close', () => {
        set!.delete(conn);
        if (set!.size === 0) docSockets.delete(roomId);
    });
}

function dropConnections(roomId: string, userId: string, message: unknown) {
    for (const conn of controls.get(roomId) ?? []) {
        if (conn.userId !== userId) continue;
        send(conn.ws, message);
        conn.ws.close(CLOSE_REMOVED, 'removed');
    }
    for (const conn of docSockets.get(roomId) ?? []) if (conn.userId === userId) conn.ws.close(CLOSE_REMOVED, 'removed');
}

// ── Joining ─────────────────────────────────────────────────────────────────

export async function createRoom(roomId: string, user: { id: string; name: string }, defaultRole: CollabRole): Promise<RoomState> {
    if (!MEMBER_ROLES.includes(defaultRole)) throw new AccessError(400, 'Choose read, comment or write as the role newcomers get');
    if (await loadRoom(roomId)) throw new AccessError(409, 'A room with this id already exists');
    const room = await prisma.collabRoom.create({
        data: {
            id: roomId,
            ownerId: user.id,
            defaultRole,
            members: { create: { userId: user.id, username: user.name, role: 'OWNER', status: 'ACTIVE' } },
        },
        include: { members: true },
    });
    return buildState(room, user.id);
}

/**
 * Enters a room. The first time, a person is only asked to wait for approval; once let in they walk straight back in,
 * until they are removed. A room nobody has set up yet (made before roles existed) belongs to whoever opens it first.
 */
export async function joinRoom(roomId: string, user: { id: string; name: string }): Promise<RoomState> {
    const name = cleanName(user.name, 'Anonymous');
    let room = await loadRoom(roomId);
    if (!room) {
        try {
            room = await prisma.collabRoom.create({
                data: { id: roomId, ownerId: user.id, members: { create: { userId: user.id, username: name, role: 'OWNER', status: 'ACTIVE' } } },
                include: { members: true },
            });
        } catch {
            room = await mustLoad(roomId); // someone else claimed it a moment ago
        }
    }

    const member = room.members.find(m => m.userId === user.id);
    if (!member) {
        await prisma.collabMember.create({ data: { roomId, userId: user.id, username: name, role: room.defaultRole, status: 'PENDING' } });
    } else if (member.status === 'KICKED') {
        // Removed people must ask again, and come back with whatever newcomers get now
        await prisma.collabMember.update({
            where: { roomId_userId: { roomId, userId: user.id } },
            data: { status: 'PENDING', role: room.defaultRole, coOwnerSince: null, username: name },
        });
    } else if (member.username !== name) {
        await prisma.collabMember.update({ where: { roomId_userId: { roomId, userId: user.id } }, data: { username: name } });
    }

    const changed = !member || member.status === 'KICKED' || member.username !== name;
    if (changed) void refresh(roomId);
    return (await stateFor(roomId, user.id))!;
}

// ── Managing people ─────────────────────────────────────────────────────────

async function managerContext(roomId: string, actorId: string) {
    const room = await mustLoad(roomId);
    const actorRole = effectiveRole(room, actorId);
    if (rankOf(actorRole) < RANK.CO_OWNER) throw new AccessError(403, 'Only the owner or a co-owner can do this');
    return { room, actorRole: actorRole as CollabRole };
}

function targetOf(room: RoomWithMembers, targetId: string): CollabMember {
    const target = room.members.find(m => m.userId === targetId);
    if (!target) throw new AccessError(404, 'That person is not in this room');
    return target;
}

const where = (roomId: string, userId: string) => ({ roomId_userId: { roomId, userId } });

export async function setDefaultRole(roomId: string, actorId: string, role: CollabRole) {
    const { actorRole } = await managerContext(roomId, actorId);
    if (actorRole !== 'OWNER') throw new AccessError(403, 'Only the owner can change the role newcomers get');
    if (!MEMBER_ROLES.includes(role)) throw new AccessError(400, 'Choose read, comment or write');
    await prisma.collabRoom.update({ where: { id: roomId }, data: { defaultRole: role } });
    await refresh(roomId);
}

export async function setMemberRole(roomId: string, actorId: string, targetId: string, role: CollabRole) {
    const { room, actorRole } = await managerContext(roomId, actorId);
    const target = targetOf(room, targetId);
    if (target.userId === room.ownerId) throw new AccessError(403, 'The owner\'s role cannot be changed');
    if (target.userId === actorId) throw new AccessError(403, 'You cannot change your own role');
    if (target.status !== 'ACTIVE') throw new AccessError(409, 'Admit them first');
    if (role !== 'CO_OWNER' && !MEMBER_ROLES.includes(role)) throw new AccessError(400, 'Unknown role');

    // You can only change people below you: a co-owner never touches another co-owner
    if (rankOf(effectiveRole(room, targetId)) >= RANK[actorRole]) throw new AccessError(403, 'You can only change the role of people below you');
    // Making or removing a co-owner is the owner's call alone
    if ((role === 'CO_OWNER' || target.role === 'CO_OWNER') && actorRole !== 'OWNER') {
        throw new AccessError(403, 'Only the owner can make or remove a co-owner');
    }

    await prisma.collabMember.update({
        where: where(roomId, targetId),
        data: { role, coOwnerSince: role === 'CO_OWNER' ? new Date() : null },
    });
    await refresh(roomId);
}

export async function kickMember(roomId: string, actorId: string, targetId: string) {
    const { room, actorRole } = await managerContext(roomId, actorId);
    const target = targetOf(room, targetId);
    if (target.userId === actorId) throw new AccessError(403, 'You cannot remove yourself; use Leave');
    if (target.status !== 'ACTIVE') throw new AccessError(409, 'They are not in the room');
    if (target.userId === room.ownerId || rankOf(effectiveRole(room, targetId)) >= RANK[actorRole]) {
        throw new AccessError(403, 'You can only remove people below you');
    }
    await prisma.collabMember.update({ where: where(roomId, targetId), data: { status: 'KICKED', coOwnerSince: null } });
    dropConnections(roomId, targetId, { type: 'kicked' });
    await refresh(roomId);
}

export async function approveRequest(roomId: string, actorId: string, targetId: string, role?: CollabRole) {
    const { room } = await managerContext(roomId, actorId);
    const target = targetOf(room, targetId);
    if (target.status !== 'PENDING') throw new AccessError(409, 'That request is no longer waiting');
    if (role && !MEMBER_ROLES.includes(role)) throw new AccessError(400, 'Choose read, comment or write');
    await prisma.collabMember.update({ where: where(roomId, targetId), data: { status: 'ACTIVE', role: role ?? room.defaultRole } });
    await refresh(roomId);
}

export async function approveAll(roomId: string, actorId: string): Promise<number> {
    const { room } = await managerContext(roomId, actorId);
    const result = await prisma.collabMember.updateMany({
        where: { roomId, status: 'PENDING' },
        data: { status: 'ACTIVE', role: room.defaultRole },
    });
    await refresh(roomId);
    return result.count;
}

export async function rejectRequest(roomId: string, actorId: string, targetId: string) {
    const { room } = await managerContext(roomId, actorId);
    const target = targetOf(room, targetId);
    if (target.status !== 'PENDING') throw new AccessError(409, 'That request is no longer waiting');
    await prisma.collabMember.update({ where: where(roomId, targetId), data: { status: 'KICKED' } });
    sendToUser(roomId, targetId, { type: 'rejected' });
    await refresh(roomId);
}

// ── Comments ────────────────────────────────────────────────────────────────

const toComment = (c: CollabComment) => ({ id: c.id, userId: c.userId, username: c.username, text: c.text, createdAt: c.createdAt.toISOString() });
export type RoomComment = ReturnType<typeof toComment>;

export async function listComments(roomId: string, userId: string): Promise<RoomComment[]> {
    const room = await mustLoad(roomId);
    if (!effectiveRole(room, userId)) throw new AccessError(403, 'Join the room to read its comments');
    const rows = await prisma.collabComment.findMany({ where: { roomId }, orderBy: { createdAt: 'desc' }, take: COMMENT_HISTORY });
    return rows.reverse().map(toComment);
}

export async function postComment(roomId: string, userId: string, text: unknown): Promise<RoomComment> {
    const room = await mustLoad(roomId);
    if (rankOf(effectiveRole(room, userId)) < RANK.COMMENT) throw new AccessError(403, 'You only have read access in this room');
    const body = typeof text === 'string' ? text.trim() : '';
    if (!body) throw new AccessError(400, 'Write something first');
    if (body.length > MAX_COMMENT_LENGTH) throw new AccessError(400, `Comments are limited to ${MAX_COMMENT_LENGTH} characters`);
    const author = room.members.find(m => m.userId === userId)!;
    const comment = toComment(await prisma.collabComment.create({ data: { roomId, userId, username: author.username, text: body } }));
    await sendToMembers(roomId, { type: 'comment', comment });
    return comment;
}

/** Owners and co-owners can remove what people below them wrote, so the thread stays clean */
export async function deleteComment(roomId: string, actorId: string, commentId: string) {
    const { room, actorRole } = await managerContext(roomId, actorId);
    const comment = await prisma.collabComment.findFirst({ where: { id: commentId, roomId } });
    if (!comment) throw new AccessError(404, 'Comment not found');
    const author = room.members.find(m => m.userId === comment.userId);
    // Judged by the author's role today (a removed author keeps the role they had)
    const authorRank = author ? (author.userId === room.ownerId ? RANK.OWNER : RANK[author.role]) : RANK.READ;
    if (authorRank >= RANK[actorRole]) throw new AccessError(403, 'You can only delete comments from people below you');
    await prisma.collabComment.delete({ where: { id: commentId } });
    await sendToMembers(roomId, { type: 'comment-deleted', id: commentId });
}

// ── Checks used by other parts of the server ────────────────────────────────

/**
 * Why this user may not use the room's files, or null if they may. A room nobody has set up has no rules yet (and
 * nothing to enforce), so it stays open, as every room was before roles existed.
 */
export async function filesAccessError(roomId: string, userId: string | undefined, needWrite: boolean): Promise<string | null> {
    if (/^(ex|ct)-/i.test(roomId)) return null; // exam and contest workspaces have their own rules
    const room = await prisma.collabRoom.findUnique({
        where: { id: roomId },
        include: { members: { where: { userId: userId ?? '' } } },
    });
    if (!room) return null;
    const member = room.members[0];
    if (!member || member.status === 'PENDING') return 'You have not been let into this room yet';
    if (member.status === 'KICKED') return 'You were removed from this room';
    if (needWrite && RANK[member.role] < RANK.WRITE) return 'You have read-only access in this room';
    return null;
}

/** For the Yjs socket: null when there is no such room set up, which means it is open */
export async function documentAccess(roomId: string, userId: string): Promise<{ allowed: boolean; readOnly: boolean } | null> {
    const room = await loadRoom(roomId);
    if (!room) return null;
    const role = effectiveRole(room, userId);
    return { allowed: !!role, readOnly: rankOf(role) < RANK.WRITE };
}

/** For the control socket: anyone waiting or inside may listen */
export async function mayListen(roomId: string, userId: string): Promise<boolean> {
    const member = await prisma.collabMember.findUnique({ where: where(roomId, userId) });
    return !!member && (member.status === 'ACTIVE' || member.status === 'PENDING');
}
