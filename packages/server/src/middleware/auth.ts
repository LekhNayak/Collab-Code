import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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

export const requireRole = (requiredRole: 'ADMIN' | 'STUDENT') => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (user.id.startsWith('guest-')) {
            if (requiredRole === 'ADMIN') {
                return res.status(403).json({ error: 'Guests cannot be ADMIN' });
            }
            return next();
        }

        if (user.role !== requiredRole) {
            return res.status(403).json({ error: `Forbidden: requires ${requiredRole} role` });
        }

        next();
    };
};
