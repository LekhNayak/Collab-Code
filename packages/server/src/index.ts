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

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '5mb' }));

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
