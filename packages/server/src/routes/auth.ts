import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db';
import { requireAuth } from '../middleware/auth';
import { loginLimiter, registerLimiter, guestLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/guest', guestLimiter, (req, res) => {
    const guestId = 'guest-' + Math.random().toString(36).substring(7);
    const token = jwt.sign(
        { id: guestId, username: `Guest_${guestId.substring(6)}` },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
    );
    res.json({ token, user: { id: guestId, username: `Guest_${guestId.substring(6)}` } });
});

router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email and password are required' });
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await prisma.user.create({
            data: { username, email, password: hashedPassword }
        });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: (user as any).role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email, role: (user as any).role },
            isNewUser: true,
        });
    } catch (err: any) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to register' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: (user as any).role },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email, role: (user as any).role },
            hasGithubCredentials: !!(user as any).githubUsername,
        });
    } catch (err: any) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Save or update the user's GitHub credentials for Git operations
router.put('/github-credentials', requireAuth, async (req, res) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId || userId.startsWith('guest-')) {
            return res.status(403).json({ error: 'Guests cannot save credentials' });
        }

        const { githubUsername, githubPat } = req.body;
        if (!githubUsername || !githubPat) {
            return res.status(400).json({ error: 'githubUsername and githubPat are required' });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { githubUsername, githubPat },
        });

        res.json({ message: 'GitHub credentials saved' });
    } catch (err: any) {
        console.error('Save credentials error:', err);
        res.status(500).json({ error: 'Failed to save credentials' });
    }
});

export default router;
