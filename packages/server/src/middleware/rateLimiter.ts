import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

// For authenticated routes, key by user ID; fall back to normalized IP for guests.
// ipKeyGenerator handles IPv6 normalization so users can't bypass limits via address variants.
const byUserId = (req: Request) => (req as any).user?.id ?? ipKeyGenerator(req.ip ?? '');

// The global limiter runs before requireAuth, so read the user from the token itself.
// Keying by IP alone would make a whole classroom behind one router share a single budget.
const byTokenUserOrIp = (req: Request) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
        try {
            const decoded: any = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'secret');
            if (decoded?.id) return `user:${decoded.id}`;
        } catch {
            // invalid token: fall through to the IP
        }
    }
    return ipKeyGenerator(req.ip ?? '');
};

// ── Auth ──────────────────────────────────────────────────────────────────────
// Protect login/register from brute-force attacks

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration attempts. Try again later.' },
});

export const guestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many guest sessions created. Try again later.' },
});

// ── Code execution ─────────────────────────────────────────────────────────────
// Most expensive operation — tight limit per user

export const executionLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Execution rate limit reached. Please wait before running more code.' },
    keyGenerator: byUserId,
});

// ── Git clone ─────────────────────────────────────────────────────────────────
// Cloning is slow and hits GitHub — limit per user

export const cloneLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many clone requests. Try again later.' },
    keyGenerator: byUserId,
});

// ── Exam event logging ────────────────────────────────────────────────────────
// Prevent flooding the exam log (tab-switch / fullscreen-exit events)

export const examEventLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests.' },
    keyGenerator: byUserId,
});

// ── Contests ──────────────────────────────────────────────────────────────────
// Running samples / custom input, and judged submissions (each runs every test case)

export const contestRunLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 12,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many runs. Please wait a moment before running again.' },
    keyGenerator: byUserId,
});

export const contestSubmitLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many submissions. Please wait a moment before submitting again.' },
    keyGenerator: byUserId,
});

export const contestEventLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests.' },
    keyGenerator: byUserId,
});

// ── General API fallback ──────────────────────────────────────────────────────
// Applied globally to all routes as a safety net

export const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    keyGenerator: byTokenUserOrIp,
});
