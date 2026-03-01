import { Request, Response, NextFunction } from 'express';

// ──────────────────────────────────────────────────────────
// Request Logger Middleware
// Logs every API request with method, URL, status, duration,
// auth info, request body (for mutations), and query params.
// ──────────────────────────────────────────────────────────

// ANSI color helpers for pretty terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
    blue: '\x1b[34m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bgGreen: '\x1b[42m',
    bgBlue: '\x1b[44m',
};

function getMethodColor(method: string): string {
    switch (method) {
        case 'GET': return colors.green;
        case 'POST': return colors.blue;
        case 'PUT': return colors.yellow;
        case 'PATCH': return colors.yellow;
        case 'DELETE': return colors.red;
        default: return colors.white;
    }
}

function getStatusColor(status: number): string {
    if (status >= 500) return colors.red;
    if (status >= 400) return colors.yellow;
    if (status >= 300) return colors.cyan;
    if (status >= 200) return colors.green;
    return colors.white;
}

function getStatusEmoji(status: number): string {
    if (status >= 500) return '💥';
    if (status >= 400) return '⚠️';
    if (status >= 300) return '↪️';
    if (status >= 200) return '✅';
    return '❓';
}

function formatDuration(ms: number): string {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

/** Truncate and sanitize body for logging (redacts sensitive fields) */
function sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveKeys = ['password', 'token', 'secret', 'authorization', 'cookie'];
    const sanitized: any = {};

    for (const [key, value] of Object.entries(body)) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.length > 200) {
            sanitized[key] = value.substring(0, 200) + `... (${value.length} chars)`;
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/** Extract user info from the request (if auth middleware has run) */
function getUserInfo(req: Request): string {
    const user = req.user as any;
    if (!user) return `${colors.gray}anonymous${colors.reset}`;
    return `${colors.magenta}${user.username || user.id || 'unknown'}${colors.reset}`;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();
    const timestamp = new Date().toISOString();

    // Capture the original res.json and res.send to log response body on errors
    const originalJson = res.json.bind(res);
    let responseBody: any = null;

    res.json = (body: any) => {
        responseBody = body;
        return originalJson(body);
    };

    // When the response finishes, log everything
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1e6;
        const status = res.statusCode;

        const methodColor = getMethodColor(req.method);
        const statusColor = getStatusColor(status);
        const emoji = getStatusEmoji(status);

        // ── Header line ──
        const separator = `${colors.gray}${'─'.repeat(70)}${colors.reset}`;
        console.log(separator);
        console.log(
            `${emoji} ${colors.gray}[${timestamp}]${colors.reset} ` +
            `${methodColor}${colors.bright}${req.method.padEnd(7)}${colors.reset} ` +
            `${colors.white}${req.originalUrl}${colors.reset}`
        );

        // ── Status & Duration ──
        console.log(
            `   ${colors.gray}Status:${colors.reset} ${statusColor}${colors.bright}${status}${colors.reset} ` +
            `${colors.gray}│ Duration:${colors.reset} ${durationMs > 1000 ? colors.red : durationMs > 200 ? colors.yellow : colors.green}${formatDuration(durationMs)}${colors.reset} ` +
            `${colors.gray}│ User:${colors.reset} ${getUserInfo(req)}`
        );

        // ── Query Params ──
        const queryKeys = Object.keys(req.query);
        if (queryKeys.length > 0) {
            console.log(
                `   ${colors.gray}Query:${colors.reset}  ${colors.cyan}${JSON.stringify(req.query)}${colors.reset}`
            );
        }

        // ── Request Body (for POST/PUT/PATCH) ──
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
            const sanitized = sanitizeBody(req.body);
            console.log(
                `   ${colors.gray}Body:${colors.reset}   ${colors.dim}${JSON.stringify(sanitized)}${colors.reset}`
            );
        }

        // ── Route Params ──
        const paramKeys = Object.keys(req.params);
        if (paramKeys.length > 0) {
            console.log(
                `   ${colors.gray}Params:${colors.reset} ${colors.dim}${JSON.stringify(req.params)}${colors.reset}`
            );
        }

        // ── Auth Header presence ──
        const hasAuth = !!(req.headers.authorization || req.query.token);
        console.log(
            `   ${colors.gray}Auth:${colors.reset}   ${hasAuth ? `${colors.green}Token present` : `${colors.red}No token`}${colors.reset}`
        );

        // ── Error Response Body (for 4xx/5xx) ──
        if (status >= 400 && responseBody) {
            console.log(
                `   ${colors.red}${colors.bright}Error:${colors.reset}  ${colors.red}${JSON.stringify(responseBody)}${colors.reset}`
            );
        }
    });

    next();
};
