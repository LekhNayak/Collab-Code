import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

// For authenticated routes, key by user ID; fall back to normalized IP for guests.
// ipKeyGenerator handles IPv6 normalization so users can't bypass limits via address variants.
const byUserId = (req: Request) => (req as any).user?.id ?? ipKeyGenerator(req.ip ?? '');

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

// ── General API fallback ──────────────────────────────────────────────────────
// Applied globally to all routes as a safety net

export const globalApiLimiter = rateLimit({
    windowMs: 60 * 1000,         // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' },
    keyGenerator: byUserId,
});
