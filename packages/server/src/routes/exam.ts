import { Router, Request, Response } from 'express';
import prisma from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { executeDirectly } from '../services/executionService';
import { examEventLimiter, executionLimiter } from '../middleware/rateLimiter';
import crypto from 'crypto';

const router = Router();

// ══════════════════════════════════════════════════════
// STATIC / LITERAL routes MUST come BEFORE /:id routes
// ══════════════════════════════════════════════════════

// POST /exam/create -> ADMIN only
router.post('/create', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { title, startTime, endTime } = req.body;

        // Generate a short, human-friendly exam room code
        const roomCode = `EX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        const exam = await prisma.exam.create({
            data: {
                title: title || 'New Exam',
                ownerId: (req.user as any).id,
                startTime: startTime ? new Date(startTime) : new Date(),
                endTime: endTime ? new Date(endTime) : null,
            },
        });

        // Auto-create the EXAM room linked to this exam
        await prisma.room.create({
            data: {
                name: roomCode,
                type: 'EXAM',
                examId: exam.id,
                createdByRole: 'ADMIN',
            },
        });

        // Return exam data + the shareable room code
        res.status(201).json({ ...exam, roomCode });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create exam', details: err.message });
    }
});

// List all user exams (Admin) — MUST be before /:id routes
router.get('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const exams = await prisma.exam.findMany({
            where: { ownerId: (req.user as any).id },
            include: { rooms: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
        // Flatten: attach the first room name as roomCode
        const result = exams.map((e: any) => ({
            ...e,
            roomCode: e.rooms?.[0]?.name || null,
            rooms: undefined,
        }));
        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch exams', details: err.message });
    }
});

// Resolve a room code (e.g. EX-a1b2c3d4) into exam metadata — MUST be before /:id routes
router.get('/resolve/:roomCode', async (req: Request, res: Response) => {
    try {
        const room = await prisma.room.findFirst({
            where: { name: req.params.roomCode },
            include: { exam: { select: { id: true, title: true, startTime: true, endTime: true, ownerId: true } } }
        });
        if (!room) return res.status(404).json({ error: 'Room not found' });
        if (room.type !== 'EXAM' || !room.exam) return res.status(400).json({ error: 'Not an exam room' });
        res.status(200).json({ room: { id: room.id, name: room.name, type: room.type }, exam: room.exam });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to resolve room', details: err.message });
    }
});

// ══════════════════════════════════════════════════════
// PARAMETRIC /:id routes below
// ══════════════════════════════════════════════════════

// GET /exam/:id/meta -> Get Exam metadata (for timer and info)
router.get('/:id/meta', async (req: Request, res: Response) => {
    try {
        const exam = await prisma.exam.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                ownerId: true
            }
        });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        res.status(200).json(exam);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch exam metadata', details: err.message });
    }
});

// GET /exam/:id/logs -> Get all exam logs (Admin)
router.get('/:id/logs', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const logs = await prisma.examLog.findMany({
            where: { examId: req.params.id },
            include: { user: { select: { username: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(logs);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch exam logs', details: err.message });
    }
});

// GET /exam/:id/sessions -> ADMIN only
router.get('/:id/sessions', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const sessions = await prisma.examSession.findMany({
            where: { examId: req.params.id },
            include: { user: { select: { username: true, email: true } } },
            orderBy: { startTime: 'desc' },
        });
        res.status(200).json(sessions);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch sessions', details: err.message });
    }
});

// POST /exam/:id/start -> ADMIN only
router.post('/:id/start', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const exam = await prisma.exam.update({
            where: { id: req.params.id },
            data: {
                startTime: new Date()
            }
        });
        res.status(200).json(exam);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to start exam', details: err.message });
    }
});

// POST /exam/:id/create-room -> ADMIN only (legacy, /create already does this)
router.post('/:id/create-room', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const randomId = crypto.randomBytes(4).toString('hex');
        const examId = req.params.id;
        const roomName = `EX-${randomId.toUpperCase()}`;

        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        const room = await prisma.room.create({
            data: {
                name: roomName,
                type: 'EXAM',
                examId: examId,
                createdByRole: 'ADMIN'
            }
        });

        res.status(201).json(room);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to create exam room', details: err.message });
    }
});

// POST /exam/:id/join -> Student joins exam (creates session + log)
router.post('/:id/join', async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any).id;
        const examId = req.params.id;

        // Verify exam exists
        const exam = await prisma.exam.findUnique({ where: { id: examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        // Ensure session exists or create one
        let session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' }, // a student can have duplicate sessions (no unique key); always use the oldest
            where: { examId, userId }
        });

        if (!session) {
            session = await prisma.examSession.create({
                data: {
                    examId,
                    userId,
                    status: 'ACTIVE'
                }
            });
        }

        const log = await prisma.examLog.create({
            data: {
                examId: examId,
                userId: userId,
                eventType: 'JOIN',
                details: JSON.stringify({ message: 'Student joined the exam room' }),
            },
        });
        res.status(201).json({ log, session });
    } catch (err: any) {
        console.error('[Exam Join Error]', err);
        res.status(500).json({ error: 'Failed to record join event', details: err.message });
    }
});

// POST /exam/:id/submit -> STUDENT only
router.post('/:id/submit', async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any).id;
        const examId = req.params.id;

        const session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId, userId, status: 'ACTIVE' }
        });

        if (!session) {
            return res.status(404).json({ error: 'Active session not found' });
        }

        const updatedSession = await prisma.examSession.update({
            where: { id: session.id },
            data: {
                status: 'SUBMITTED',
                endTime: new Date()
            }
        });

        res.status(200).json(updatedSession);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to submit exam', details: err.message });
    }
});

// POST /exam/:id/execute -> Execute code in exam mode and capture log
router.post('/:id/execute', executionLimiter, async (req: Request, res: Response) => {
    try {
        const { code, language, stdin, args } = req.body;

        const result = await executeDirectly({ code, language, stdin, args });

        await prisma.examLog.create({
            data: {
                examId: req.params.id,
                userId: (req.user as any).id,
                eventType: 'EXECUTE',
                codeSnapshot: code,
                details: JSON.stringify(result),
            },
        }).catch((err: any) => console.error('[Exam Execution Log Error]', err));

        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Execution failed', details: err.message });
    }
});

// POST /exam/:id/alert -> Copy-paste alert log
router.post('/:id/alert', async (req: Request, res: Response) => {
    try {
        const { pastedLength, content } = req.body;
        const log = await prisma.examLog.create({
            data: {
                examId: req.params.id,
                userId: (req.user as any).id,
                eventType: 'COPY_PASTE_ALERT',
                codeSnapshot: content || undefined,
                details: JSON.stringify({ pastedLength }),
            },
        });
        res.status(201).json(log);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save alert', details: err.message });
    }
});

// POST /exam/:id/tab-switch -> Tab switch detected
router.post('/:id/tab-switch', examEventLimiter, async (req: Request, res: Response) => {
    try {
        const examId = req.params.id;
        const userId = (req.user as any).id;
        
        // Log the event
        const log = await prisma.examLog.create({
            data: {
                examId,
                userId,
                eventType: 'TAB_SWITCH',
                details: JSON.stringify({ message: 'User switched tabs' }),
            },
        });
        
        // Update session
        let session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId, userId, status: 'ACTIVE' }
        });
        
        if (session) {
            const newCount = session.tabSwitchCount + 1;
            const shouldBlock = newCount >= 3;
            
            session = await prisma.examSession.update({
                where: { id: session.id },
                data: {
                    tabSwitchCount: newCount,
                    isBlocked: shouldBlock ? true : session.isBlocked,
                    blockedAt: shouldBlock && !session.isBlocked ? new Date() : session.blockedAt,
                    blockedReason: shouldBlock && !session.isBlocked ? 'Exceeded maximum tab switches' : session.blockedReason
                }
            });
        }
        res.status(201).json({ log, session });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save tab-switch log', details: err.message });
    }
});

// POST /exam/:id/fullscreen-exit -> Fullscreen exit detected
router.post('/:id/fullscreen-exit', examEventLimiter, async (req: Request, res: Response) => {
    try {
        const examId = req.params.id;
        const userId = (req.user as any).id;
        
        const log = await prisma.examLog.create({
            data: {
                examId,
                userId,
                eventType: 'FULLSCREEN_EXIT',
                details: JSON.stringify({ message: 'User exited fullscreen mode' }),
            },
        });
        res.status(201).json({ log });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to save fullscreen-exit log', details: err.message });
    }
});

// GET /exam/:id/my-session -> Get current student's session
router.get('/:id/my-session', async (req: Request, res: Response) => {
    try {
        const session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId: req.params.id, userId: (req.user as any).id }
        });
        res.status(200).json(session || { isBlocked: false });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch session', details: err.message });
    }
});

// POST /exam/:id/block -> ADMIN only
router.post('/:id/block', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { userId, reason } = req.body;
        const session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId: req.params.id, userId }
        });
        if (!session) return res.status(404).json({ error: 'Session not found for user' });
        
        const updated = await prisma.examSession.update({
            where: { id: session.id },
            data: {
                isBlocked: true,
                blockedAt: new Date(),
                blockedReason: reason || 'Blocked by admin'
            }
        });
        res.status(200).json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to block student', details: err.message });
    }
});

// POST /exam/:id/unblock -> ADMIN only
router.post('/:id/unblock', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId: req.params.id, userId }
        });
        if (!session) return res.status(404).json({ error: 'Session not found for user' });
        
        const updated = await prisma.examSession.update({
            where: { id: session.id },
            data: {
                isBlocked: false,
                blockedAt: null,
                blockedReason: null,
                tabSwitchCount: 0 // Resetting count so they don't get blocked immediately again
            }
        });
        res.status(200).json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to unblock student', details: err.message });
    }
});

// POST /exam/:id/remove-student -> ADMIN only — removes a student from the exam
router.post('/:id/remove-student', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const session = await prisma.examSession.findFirst({
            orderBy: { startTime: 'asc' },
            where: { examId: req.params.id, userId }
        });
        if (!session) return res.status(404).json({ error: 'Session not found for user' });

        const updated = await prisma.examSession.update({
            where: { id: session.id },
            data: {
                status: 'REMOVED',
                isBlocked: true,
                blockedAt: new Date(),
                blockedReason: 'Removed from exam by admin'
            }
        });

        await prisma.examLog.create({
            data: {
                examId: req.params.id,
                userId,
                eventType: 'SUSPICIOUS_BEHAVIOR',
                details: JSON.stringify({ message: 'Student removed from exam by admin' }),
            }
        });

        res.status(200).json(updated);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to remove student', details: err.message });
    }
});

// DELETE /exam/:id -> Delete an Exam (Admin)
router.delete('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
    try {
        const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        if (exam.ownerId !== (req.user as any).id) {
            return res.status(403).json({ error: 'Only the owner can delete this exam' });
        }

        // Delete in correct order to respect FK constraints
        await prisma.examLog.deleteMany({ where: { examId: req.params.id } });
        await prisma.examSession.deleteMany({ where: { examId: req.params.id } });
        await prisma.room.deleteMany({ where: { examId: req.params.id } });
        await prisma.exam.delete({ where: { id: req.params.id } });

        res.status(200).json({ message: 'Exam deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete exam', details: err.message });
    }
});

export default router;
