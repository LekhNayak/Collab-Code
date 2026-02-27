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
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};
