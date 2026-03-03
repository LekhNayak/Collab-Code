import { Server } from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';
import jwt from 'jsonwebtoken';
import prisma from '../db';

export const setupWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws: any, req: any, socketConfig: any) => {
        const { docName } = socketConfig as any;

        // Override req.url so y-websocket's setupWSConnection uses our computed docName
        // y-websocket defaults to req.url.slice(1).split('?')[0] if no docName option given
        // But passing docName as option SHOULD work. Belt-and-suspenders: override req.url too.
        req.url = '/' + docName;

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
            const user = await prisma.user.findUnique({ where: { id: decoded.id } });

            if (!user) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                return socket.destroy();
            }

            // Get mode and IDs from query params (explicit) or fallback to URL path
            const mode = url.searchParams.get('mode');
            const pathRoomId = url.pathname.substring(1); // strip leading /

            let docName = pathRoomId;
            let isReadOnly = false;

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

                // Map admin to the SAME Yjs doc the student writes to
                docName = `exam-${examId}-${studentId}`;
                isReadOnly = true;

            } else if (pathRoomId.startsWith('EX-')) {
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

                if ((user as any).role === 'ADMIN') {
                    docName = `exam-${exam.id}-admin`;
                    isReadOnly = true;
                } else {
                    // Auto-create session if needed
                    let session = await prisma.examSession.findFirst({
                        where: { examId: exam.id, userId: user.id }
                    });
                    if (!session) {
                        session = await prisma.examSession.create({
                            data: { examId: exam.id, userId: user.id, status: 'ACTIVE' }
                        });
                    }

                    // Per-student isolation: unique Yjs doc per student
                    docName = `exam-${exam.id}-${user.id}`;
                }
            } else {
                // ── COLLAB mode ──
                docName = `collab-${pathRoomId}`;
            }

            console.log(`[WS] user=${user.username} role=${(user as any).role} path=${pathRoomId} mode=${mode || 'normal'} → doc="${docName}" readOnly=${isReadOnly}`);

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
