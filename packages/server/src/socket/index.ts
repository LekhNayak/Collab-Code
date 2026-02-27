import { Server } from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

// Global map to store Yjs documents in memory
// In production, you'd want to persist these to disk or DB
const docs = new Map<string, Y.Doc>();

export const setupWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ noServer: true });

    wss.on('connection', (ws, req) => {
        const url = req.url;
        if (!url) {
            ws.close();
            return;
        }

        const docName = url.replace('/', '');

        // Use y-websocket utils to handle the connection
        // This handles the synching protocol automatically
        setupWSConnection(ws, req, { docName });
    });

    server.on('upgrade', (request, socket, head) => {
        try {
            const urlParams = new URL(request.url || '', 'ws://localhost').searchParams;
            const token = urlParams.get('token');

            // Reject if token is absent or invalid
            if (!token) throw new Error("Unauthenticated WebSocket upgrade.");

            // Note: We need to import jwt at the top if it isn't, but doing requires inside logic is messy.
            // Better to handle it properly. 
            const jwt = require('jsonwebtoken');
            jwt.verify(token, process.env.JWT_SECRET || 'secret');

            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } catch (err) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
        }
    });

    console.log('WebSocket Server Initialized for Collaboration');
};
