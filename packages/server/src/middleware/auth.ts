import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';

// Use Express request extended by passport definitions

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    // 1. Check for token in Authorization header
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        // Fallback for websocket / alternative auth
        token = req.query.token as string;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    try {
        // 2. Verify token
        const secret = process.env.JWT_SECRET || 'secret';
        const decoded = jwt.verify(token, secret);

        // 3. Attach user to request
        (req as any).user = decoded;
        next();
    } catch (error: any) {
        console.error('Auth verification failed:', error.message);
        return res.status(401).json({
            error: 'Invalid or expired token.',
            details: error.message
        });
    }
};

const roleCache = new Map<string, { role: string; timestamp: number }>();
const ROLE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const requireRole = (requiredRole: 'ADMIN' | 'STUDENT') => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            // For guests, we might not have them in DB. Let's handle 'guest' IDs.
            if (user.id.startsWith('guest-')) {
                if (requiredRole === 'ADMIN') {
                    return res.status(403).json({ error: 'Guests cannot be ADMIN' });
                }
                return next(); // allow guests to act as STUDENT? sure.
            }

            // Check cache first
            const cached = roleCache.get(user.id);
            if (cached && (Date.now() - cached.timestamp < ROLE_CACHE_TTL)) {
                if (cached.role !== requiredRole) {
                    return res.status(403).json({ error: `Forbidden: requires ${requiredRole} role` });
                }
                return next();
            }

            const dbUser = await prisma.user.findUnique({
                where: { id: user.id }
            });

            if (!dbUser) {
                return res.status(401).json({ error: 'User not found' });
            }

            const userRole = (dbUser as any).role;
            // Set cache
            roleCache.set(user.id, { role: userRole, timestamp: Date.now() });

            if (userRole !== requiredRole) {
                return res.status(403).json({ error: `Forbidden: requires ${requiredRole} role` });
            }

            next();
        } catch (error: any) {
            console.error('Role verification failed:', error.message);
            res.status(500).json({ error: 'Role verification failed' });
        }
    };
};
