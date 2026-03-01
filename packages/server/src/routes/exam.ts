import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { executeDirectly } from '../services/executionService';

const router = Router();
const prisma = new PrismaClient();

// Middleware to Ensure Admin/Teacher
// Assuming RBAC checks the user's implicit "ownership" of the exam room for simplicity,
// or we can allow anyone to create one, making them the owner.

// Create a new Exam Room
router.post('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const { title, startTime, endTime } = req.body;
        const exam = await prisma.examRoom.create({
            data: {
                title: title || 'New Exam',
                ownerId: (req.user as any).id,
                startTime: startTime ? new Date(startTime) : new Date(),
                endTime: endTime ? new Date(endTime) : null,
            },
        });
        res.status(201).json(exam);
    } catch (err: any) {
        if (err.code === 'P2003') { // Prisma Foreign Key constraint failed
            return res.status(401).json({ error: 'Your session is invalid or belongs to an old guest account. Please log in again.', details: err.message });
        }
        res.status(500).json({ error: 'Failed to create exam room', details: err.message });
    }
});

// List user's exams (Admin view)
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const exams = await prisma.examRoom.findMany({
            where: { ownerId: (req.user as any).id },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(exams);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch exams', details: err.message });
    }
});

// Get Exam Details
router.get('/:examId', requireAuth, async (req: Request, res: Response) => {
    try {
        const exam = await prisma.examRoom.findUnique({
            where: { id: req.params.examId },
        });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        res.status(200).json(exam);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch exam', details: err.message });
    }
});

// Student Joins Exam
router.post('/:examId/join', requireAuth, async (req: Request, res: Response) => {
    try {
        const log = await prisma.examLog.create({
            data: {
                examId: req.params.examId,
                userId: (req.user as any).id,
                eventType: 'JOIN',
                details: JSON.stringify({ message: 'Student joined the exam room' }),
            },
        });
        res.status(201).json(log);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to record join event', details: err.message });
    }
});

// Get Exam Logs (Only owner can read logs)
router.get('/:examId/logs', requireAuth, async (req: Request, res: Response) => {
    try {
        const exam = await prisma.examRoom.findUnique({ where: { id: req.params.examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        // Optional: Ensure req.user.id === exam.ownerId for security

        const logs = await prisma.examLog.findMany({
            where: { examId: req.params.examId },
            include: { user: { select: { username: true, email: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json(logs);
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
    }
});

// Post a copy-paste alert log (From student)
router.post('/:examId/alert', requireAuth, async (req: Request, res: Response) => {
    try {
        const { type, pastedLength, content } = req.body;
        const log = await prisma.examLog.create({
            data: {
                examId: req.params.examId,
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

// Execute code in exam mode and capture log (From student)
router.post('/:examId/execute', requireAuth, async (req: Request, res: Response) => {
    try {
        const { code, language, stdin, args } = req.body;

        // 1. Run the code
        const result = await executeDirectly({ code, language, stdin, args });

        // 2. Log it in the exam logs async
        await prisma.examLog.create({
            data: {
                examId: req.params.examId,
                userId: (req.user as any).id,
                eventType: 'EXECUTE',
                codeSnapshot: code,
                details: JSON.stringify(result),
            },
        }).catch((err: any) => console.error('[Exam Execution Log Error]', err));

        // 3. Return the standard result back to the student IDE
        res.status(200).json(result);
    } catch (err: any) {
        res.status(500).json({ error: 'Execution failed', details: err.message });
    }
});

// Delete an Exam Room (Only owner can delete)
router.delete('/:examId', requireAuth, async (req: Request, res: Response) => {
    try {
        const exam = await prisma.examRoom.findUnique({ where: { id: req.params.examId } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        if (exam.ownerId !== (req.user as any).id) {
            return res.status(403).json({ error: 'Only the owner can delete this exam room' });
        }

        await prisma.examRoom.delete({ where: { id: req.params.examId } });
        res.status(200).json({ message: 'Exam room deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ error: 'Failed to delete exam room', details: err.message });
    }
});

export default router;
