import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import gitRoutes from './routes/git';
import executionRoutes from './routes/execution';
import sessionRoutes from './routes/sessions';
import examRoutes from './routes/exam';
import contestRoutes from './routes/contests';
import { requestLogger } from './middleware/requestLogger';
import { globalApiLimiter } from './middleware/rateLimiter';

const app = express();
const port = process.env.PORT || 3001;

// Behind Render/Fly's load balancer every request arrives from the proxy's IP; trust X-Forwarded-For
// so IP-based rate limits apply per client instead of to all users at once.
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 1 : 0)));

// Browsers send Origin without a trailing slash; accept FRONTEND_URL with or without scheme/slash
const toOrigin = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`).replace(/\/+$/, '');

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
if (process.env.FRONTEND_URL) {
    process.env.FRONTEND_URL.split(',').map(u => u.trim()).filter(Boolean).forEach(u => allowedOrigins.push(toOrigin(u)));
}
console.log(`[Init] CORS origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '5mb' }));

// Health check for the platform (registered before rate limiting/logging so probes don't count)
app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
});

// ── Global rate limit (200 req/min per user, safety net for all routes) ──
app.use(globalApiLimiter);

// ── API Request Logger ──
app.use(requestLogger);

import { requireAuth } from './middleware/auth';

app.use('/auth', authRoutes);
app.use('/git', requireAuth, gitRoutes);
app.use('/execute', requireAuth, executionRoutes);
app.use('/sessions', requireAuth, sessionRoutes);
app.use('/exam', requireAuth, examRoutes);
app.use('/contests', requireAuth, contestRoutes);

app.get('/', (req, res) => {
    res.send('Collaborative IDE API Gateway');
});

import { setupWebSocket } from './socket/index';
import { flushAll } from './collab/persistence';
import { importLegacySessions } from './services/sessionService';
import { loadCustomExtensions } from './services/extensionRegistry';
import { startJudge, stopJudge } from './services/contest/judge';

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`[Init] API Gateway is ready`);
});

setupWebSocket(server);

importLegacySessions().catch(err => console.error('[Init] Failed to import legacy sessions:', err));
loadCustomExtensions().catch(err => console.error('[Init] Failed to load custom extensions:', err));
startJudge();

// Save open documents before exiting. The server runs as PID 1 in the container (exec in start.sh),
// so without a handler SIGTERM is ignored and the platform eventually SIGKILLs it mid-edit.
const SHUTDOWN_TIMEOUT_MS = 20000;
let shuttingDown = false;
const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    // Submissions being judged are picked up again after the restart
    stopJudge();
    console.log(`[Shutdown] ${signal} received, saving open documents...`);
    await Promise.race([flushAll(), new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS))]);
    process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', err => console.error('[Process] Unhandled rejection:', err));
