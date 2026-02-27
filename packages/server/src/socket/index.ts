import { Server } from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';
import jwt from 'jsonwebtoken';

// Global map to store Yjs documents in memory
const docs = new Map<string, Y.Doc>();

export const setupWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req) => {
        const url = req.url;
        if (!url) {
            ws.close();
            return;
        }

        // Room name is the path after the first /
        const docName = new URL(url, 'ws://localhost').pathname.replace(/^\//, '');

        setupWSConnection(ws, req, { docName });
    });

    server.on('upgrade', (request, socket, head) => {
        try {
            const url = new URL(request.url || '', 'ws://localhost');
            const token = url.searchParams.get('token');

            if (!token) {
                console.error('[WS Upgrade] Missing token');
                throw new Error("Unauthenticated");
            }

            const secret = process.env.JWT_SECRET || 'secret';
            jwt.verify(token, secret);

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } catch (err: any) {
            console.error('[WS Upgrade] Error:', err.message);
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
        }
    });

    console.log('WebSocket Server Initialized for Collaboration');
};
