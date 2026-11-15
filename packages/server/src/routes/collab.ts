import { Router, Request, Response } from 'express';
import type { CollabRole } from '@prisma/client';
import { isValidWorkspaceId } from '../services/WorkspaceStore';
import * as rooms from '../collab/rooms';

// Room access: creating a room, asking to join, admitting / removing / re-roling people, and the comment thread.
// Who may do what is decided in collab/rooms.ts; this file only reads the request and reports the outcome.
const router = Router();

const ROLES: CollabRole[] = ['OWNER', 'CO_OWNER', 'WRITE', 'COMMENT', 'READ'];
const asRole = (value: unknown): CollabRole | undefined => (ROLES.includes(value as CollabRole) ? (value as CollabRole) : undefined);

const userOf = (req: Request): { id: string; username: string } => (req as any).user;

// Same reservation the sockets make: exam and contest workspaces are not collab rooms
router.param('roomId', (req, res, next, id) => {
    if (!isValidWorkspaceId(id) || /^(ex|ct)-/i.test(id)) return res.status(400).json({ error: 'Invalid room id' });
    next();
});

const fail = (res: Response, err: unknown) => {
    if (err instanceof rooms.AccessError) return res.status(err.status).json({ error: err.message });
    console.error('[Collab]', err);
    res.status(500).json({ error: 'Something went wrong' });
};

const nameOf = (req: Request) => {
    const user = userOf(req);
    const typed = typeof req.body?.name === 'string' ? req.body.name : '';
    return typed.trim() || user.username || 'Anonymous';
};

// Create a room, choosing the role everyone who joins will get
router.post('/rooms', async (req: Request, res: Response) => {
    const { roomId } = req.body ?? {};
    if (!isValidWorkspaceId(roomId) || /^(ex|ct)-/i.test(roomId)) return res.status(400).json({ error: 'Invalid room id' });
    const defaultRole = asRole(req.body?.defaultRole);
    if (!defaultRole) return res.status(400).json({ error: 'Choose the role people get when they join' });
    try {
        res.status(201).json(await rooms.createRoom(roomId, { id: userOf(req).id, name: nameOf(req) }, defaultRole));
    } catch (err) {
        fail(res, err);
    }
});

// Enter a room (or ask to). Answers with this person's standing: pending, active or removed.
router.post('/rooms/:roomId/join', async (req: Request, res: Response) => {
    try {
        res.json(await rooms.joinRoom(req.params.roomId, { id: userOf(req).id, name: nameOf(req) }));
    } catch (err) {
        fail(res, err);
    }
});

router.get('/rooms/:roomId', async (req: Request, res: Response) => {
    try {
        const state = await rooms.stateFor(req.params.roomId, userOf(req).id);
        if (!state) return res.status(404).json({ error: 'Room not found' });
        res.json(state);
    } catch (err) {
        fail(res, err);
    }
});

// The role newcomers get from now on (owner only)
router.patch('/rooms/:roomId', async (req: Request, res: Response) => {
    const role = asRole(req.body?.defaultRole);
    if (!role) return res.status(400).json({ error: 'Choose read, comment or write' });
    try {
        await rooms.setDefaultRole(req.params.roomId, userOf(req).id, role);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

router.post('/rooms/:roomId/members/:userId/role', async (req: Request, res: Response) => {
    const role = asRole(req.body?.role);
    if (!role || role === 'OWNER') return res.status(400).json({ error: 'Unknown role' });
    try {
        await rooms.setMemberRole(req.params.roomId, userOf(req).id, req.params.userId, role);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

router.post('/rooms/:roomId/members/:userId/kick', async (req: Request, res: Response) => {
    try {
        await rooms.kickMember(req.params.roomId, userOf(req).id, req.params.userId);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

// Let everyone who is waiting in
router.post('/rooms/:roomId/requests/approve-all', async (req: Request, res: Response) => {
    try {
        res.json({ admitted: await rooms.approveAll(req.params.roomId, userOf(req).id) });
    } catch (err) {
        fail(res, err);
    }
});

router.post('/rooms/:roomId/requests/:userId/approve', async (req: Request, res: Response) => {
    const role = req.body?.role === undefined ? undefined : asRole(req.body.role);
    if (req.body?.role !== undefined && !role) return res.status(400).json({ error: 'Unknown role' });
    try {
        await rooms.approveRequest(req.params.roomId, userOf(req).id, req.params.userId, role);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

router.post('/rooms/:roomId/requests/:userId/reject', async (req: Request, res: Response) => {
    try {
        await rooms.rejectRequest(req.params.roomId, userOf(req).id, req.params.userId);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

router.get('/rooms/:roomId/comments', async (req: Request, res: Response) => {
    try {
        res.json(await rooms.listComments(req.params.roomId, userOf(req).id));
    } catch (err) {
        fail(res, err);
    }
});

router.post('/rooms/:roomId/comments', async (req: Request, res: Response) => {
    try {
        res.status(201).json(await rooms.postComment(req.params.roomId, userOf(req).id, req.body?.text));
    } catch (err) {
        fail(res, err);
    }
});

router.delete('/rooms/:roomId/comments/:commentId', async (req: Request, res: Response) => {
    try {
        await rooms.deleteComment(req.params.roomId, userOf(req).id, req.params.commentId);
        res.json({ ok: true });
    } catch (err) {
        fail(res, err);
    }
});

export default router;
