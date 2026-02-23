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
        // You can handle auth here
        const handleAuth = (ws: any) => {
            wss.emit('connection', ws, request);
        };

        wss.handleUpgrade(request, socket, head, handleAuth);
    });

    console.log('WebSocket Server Initialized for Collaboration');
};
