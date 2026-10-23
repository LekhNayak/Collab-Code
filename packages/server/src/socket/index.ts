import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { initCollabPersistence, docNameFor, isLive } from '../collab/persistence';
import { isValidWorkspaceId } from '../services/WorkspaceStore';
import { phaseOf } from '../services/contest/access';

// Drops document updates from a read-only client while still letting it receive the document:
// sync step 1 (asking for state) and awareness (cursors/presence) pass through, sync step 2 and
// incremental updates (message type 0, sub-type 1 or 2) are discarded.
const makeReadOnly = (ws: any) => {
    const on = ws.on.bind(ws);
    ws.on = (event: string, listener: (...args: any[]) => void) => {
        if (event !== 'message') return on(event, listener);
        return on(event, (data: any, ...rest: any[]) => {
            const bytes = new Uint8Array(data);
            if (bytes[0] === 0 && bytes[1] !== 0) return;
            listener(data, ...rest);
        });
    };
};

export const setupWebSocket = (server: Server) => {
    initCollabPersistence();
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws: any, req: any, socketConfig: any) => {
        const { docName, isReadOnly } = socketConfig as any;

        // Override req.url so y-websocket's setupWSConnection uses our computed docName
        // y-websocket defaults to req.url.slice(1).split('?')[0] if no docName option given
        // But passing docName as option SHOULD work. Belt-and-suspenders: override req.url too.
        req.url = '/' + docName;

        if (isReadOnly) makeReadOnly(ws);
        setupWSConnection(ws, req, { docName });

        console.log(`[WS] Yjs doc registered: "${docName}"`);
    });

    server.on('upgrade', async (request, socket, head) => {
        try {
            const url = new URL(request.url || '', 'ws://localhost');
            const token = url.searchParams.get('token');

            if (!token) {
                console.error('[WS Upgrade] Missing token');
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                return socket.destroy();
            }

            const secret = process.env.JWT_SECRET || 'secret';
            const decoded: any = jwt.verify(token, secret);

            // Get mode and IDs from query params (explicit) or fallback to URL path
            const mode = url.searchParams.get('mode');
            const pathRoomId = url.pathname.substring(1); // strip leading /

            // Each doc mirrors one workspace: ws-<workspaceId>, the same id the REST API uses
            let docName: string;
            let isReadOnly = false;

            if (mode === 'admin-monitor' || pathRoomId.startsWith('EX-')) {
                // Exam modes need the real user (role, exam session); collab only needs the token
                const user = await prisma.user.findUnique({ where: { id: decoded.id } });
                if (!user) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    return socket.destroy();
                }

                if (mode === 'admin-monitor') {
                    // ── ADMIN MONITOR: admin viewing a specific student's live doc ──
                    const examId = url.searchParams.get('examId');
                    const studentId = url.searchParams.get('studentId');

                    if (!examId || !studentId) {
                        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                        return socket.destroy();
                    }
                    if ((user as any).role !== 'ADMIN') {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                        return socket.destroy();
                    }

                    // An exam can have several room codes; use the one the student is connected through
                    const rooms = await prisma.room.findMany({ where: { examId, type: 'EXAM' } });
                    const workspaceIds = rooms.filter(r => r.name).map(r => `${r.name}__${studentId}`);
                    if (workspaceIds.length === 0) {
                        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                        return socket.destroy();
                    }
                    docName = docNameFor(workspaceIds.find(isLive) ?? workspaceIds[0]);
                    isReadOnly = true;
                } else {
                    // ── EXAM mode: student or admin entering an exam room ──
                    const room = await prisma.room.findFirst({ where: { name: pathRoomId } });
                    if (!room || room.type !== 'EXAM') {
                        console.error(`[WS] Room not found or not EXAM: ${pathRoomId}`);
                        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                        return socket.destroy();
                    }

                    const exam = await prisma.exam.findUnique({ where: { id: room.examId as string } });
                    if (!exam) {
                        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                        return socket.destroy();
                    }

                    if ((user as any).role !== 'ADMIN') {
                        // Auto-create session if needed
                        const session = await prisma.examSession.findFirst({
                            orderBy: { startTime: 'asc' }, // a student can have duplicate sessions (no unique key); always use the oldest
                            where: { examId: exam.id, userId: user.id }
                        });
                        if (!session) {
                            await prisma.examSession.create({
                                data: { examId: exam.id, userId: user.id, status: 'ACTIVE' }
                            });
                        }
                    }

                    // Per-user isolation: each student (and the admin) gets their own workspace
                    docName = docNameFor(`${pathRoomId}__${user.id}`);
                }
            } else if (mode === 'contest-monitor') {
                // ── CONTEST MONITOR: the organizer watching one participant's code (read-only) ──
                const contestId = url.searchParams.get('contestId');
                const participantId = url.searchParams.get('participantId');
                const contest = contestId ? await prisma.contest.findUnique({ where: { id: contestId } }) : null;
                if (!contest || !participantId) {
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    return socket.destroy();
                }
                if (contest.ownerId !== decoded.id) {
                    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    return socket.destroy();
                }
                docName = docNameFor(`${contest.code}__${participantId}`);
                isReadOnly = true;
            } else if (pathRoomId.startsWith('CT-')) {
                // ── CONTEST: a participant's own workspace; editable only while the contest is live ──
                const contest = await prisma.contest.findUnique({ where: { code: pathRoomId } });
                if (!contest) {
                    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                    return socket.destroy();
                }
                const phase = phaseOf(contest);
                if (contest.ownerId !== decoded.id) {
                    const participant = await prisma.contestParticipant.findUnique({
                        where: { contestId_userId: { contestId: contest.id, userId: String(decoded.id) } },
                    });
                    const allowed = participant
                        && (phase === 'LIVE' ? participant.status === 'ACTIVE' : phase === 'ENDED' && participant.status !== 'REMOVED');
                    if (!allowed) {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                        return socket.destroy();
                    }
                    isReadOnly = phase === 'ENDED';
                }
                docName = docNameFor(`${contest.code}__${decoded.id}`);
            } else {
                // ── COLLAB mode: shared workspace per room; guests are allowed ──
                // (ex-/ct- in any case are reserved so a collab room can't alias an exam or contest workspace)
                if (!isValidWorkspaceId(pathRoomId) || /^(ex|ct)-/i.test(pathRoomId)) {
                    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                    return socket.destroy();
                }
                docName = docNameFor(pathRoomId);
            }

            console.log(`[WS] user=${decoded.username} role=${decoded.role || 'GUEST'} path=${pathRoomId} mode=${mode || 'normal'} → doc="${docName}" readOnly=${isReadOnly}`);

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request, { docName, isReadOnly });
            });
        } catch (err: any) {
            console.error('[WS Upgrade] Error:', err.message);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
        }
    });

    console.log('WebSocket Server Initialized for Dual Mode');
};
