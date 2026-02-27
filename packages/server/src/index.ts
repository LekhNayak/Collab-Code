import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport';
import authRoutes from './routes/auth';
import gitRoutes from './routes/git';
import executionRoutes from './routes/execution';
import sessionRoutes from './routes/sessions';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '5mb' }));

app.use(session({
    secret: process.env.JWT_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

import { requireAuth } from './middleware/auth';

app.use('/auth', authRoutes);
app.use('/git', requireAuth, gitRoutes);
app.use('/execute', requireAuth, executionRoutes);
app.use('/sessions', requireAuth, sessionRoutes);

app.get('/', (req, res) => {
    res.send('Collaborative IDE API Gateway');
});

import { setupWebSocket } from './socket/index';

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`[Init] API Gateway is ready`);
});

setupWebSocket(server);
