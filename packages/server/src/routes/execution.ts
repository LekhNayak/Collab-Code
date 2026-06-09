import { Router, Request, Response } from 'express';
import { enqueueExecution, getExecutionResult, executeDirectly } from '../services/executionService';
import { executionLimiter } from '../middleware/rateLimiter';

const router = Router();

// Execute code (queued)
router.post('/run', executionLimiter, async (req: Request, res: Response) => {
    const { code, language, stdin, args } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'code and language are required' });
    }

    try {
        const jobId = await enqueueExecution({ code, language, stdin, args });
        res.status(202).json({ jobId, status: 'queued' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to enqueue execution' });
    }
});

// Execute code directly (synchronous, no queue)
router.post('/run/direct', executionLimiter, async (req: Request, res: Response) => {
    const { code, language, stdin, args } = req.body;

    if (!code || !language) {
        return res.status(400).json({ error: 'code and language are required' });
    }

    try {
        const result = await executeDirectly({ code, language, stdin, args });
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Execution failed' });
    }
});

// Get execution result
router.get('/result/:jobId', (req: Request, res: Response) => {
    const { jobId } = req.params;
    const result = getExecutionResult(jobId);

    if (!result) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.status(200).json(result);
});

export default router;
