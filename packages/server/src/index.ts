import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import gitRoutes from './routes/git';
import executionRoutes from './routes/execution';
import sessionRoutes from './routes/sessions';
import examRoutes from './routes/exam';
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

app.get('/', (req, res) => {
    res.send('Collaborative IDE API Gateway');
});

import { setupWebSocket } from './socket/index';

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`[Init] API Gateway is ready`);
});

setupWebSocket(server);
