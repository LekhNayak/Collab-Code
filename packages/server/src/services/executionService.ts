import { Queue, Worker, Job } from 'bullmq';

// Redis connection config (used by BullMQ internally)
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

console.log(`[Execution] Redis config: ${redisConfig.host}:${redisConfig.port}`);

// Piston API base URL
const PISTON_URL = 'http://127.0.0.1:2358';
console.log(`[Execution] Piston URL (HARDCODED): ${PISTON_URL}`);
if (typeof fetch === 'undefined') {
    console.error('[Execution] Global fetch is UNDEFINED! Node version may be too old.');
} else {
    console.log('[Execution] Global fetch is available');
}

// Language name mapping for Piston (must match installed runtime names)
const LANG_MAP: Record<string, { language: string; version: string }> = {
    python: { language: 'python', version: '3.10.0' },
    py: { language: 'python', version: '3.10.0' },
    javascript: { language: 'javascript', version: '18.15.0' },
    js: { language: 'javascript', version: '18.15.0' },
    node: { language: 'javascript', version: '18.15.0' },
    typescript: { language: 'typescript', version: '5.0.3' },
    ts: { language: 'typescript', version: '5.0.3' },
    java: { language: 'java', version: '15.0.2' },
    c: { language: 'c', version: '10.2.0' },
    cpp: { language: 'c++', version: '10.2.0' },
    'c++': { language: 'c++', version: '10.2.0' },
    go: { language: 'go', version: '1.16.2' },
    rust: { language: 'rust', version: '1.68.2' },
    bash: { language: 'bash', version: '5.2.0' },
    shell: { language: 'bash', version: '5.2.0' },
};

export interface ExecutionRequest {
    code: string;
    language: string;
    stdin?: string;
    args?: string[];
}

export interface ExecutionResult {
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
    executionTime?: number;
}

// In-memory result store (in production, use Redis)
const resultStore = new Map<string, ExecutionResult>();

// ---- Queue ----
const executionQueue = new Queue('code-execution', { connection: redisConfig });

// ---- Worker ----
const worker = new Worker(
    'code-execution',
    async (job: Job) => {
        const { code, language, stdin, args } = job.data as ExecutionRequest;
        const startTime = Date.now();

        // Update status
        resultStore.set(job.id!, {
            jobId: job.id!,
            status: 'running',
        });

        const langConfig = LANG_MAP[language.toLowerCase()];
        if (!langConfig) {
            throw new Error(`Unsupported language: ${language}. Supported: ${Object.keys(LANG_MAP).join(', ')}`);
        }

        try {
            const response = await fetch(`${PISTON_URL}/api/v2/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: langConfig.language,
                    version: langConfig.version,
                    files: [{ content: code }],
                    stdin: stdin || '',
                    args: args || [],
                    run_timeout: 3000,    // 3s max (Piston default limit)
                    compile_timeout: 3000,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Piston API error (${response.status}): ${text}`);
            }

            const data = await response.json();
            const executionTime = Date.now() - startTime;

            const result: ExecutionResult = {
                jobId: job.id!,
                status: 'completed',
                stdout: data.run?.stdout || '',
                stderr: data.run?.stderr || data.compile?.stderr || '',
                exitCode: data.run?.code ?? -1,
                executionTime,
            };

            resultStore.set(job.id!, result);
            return result;
        } catch (error: any) {
            const result: ExecutionResult = {
                jobId: job.id!,
                status: 'failed',
                error: error.message,
                executionTime: Date.now() - startTime,
            };
            resultStore.set(job.id!, result);
            throw error;
        }
    },
    {
        connection: redisConfig,
        concurrency: 5,
    }
);

worker.on('failed', (job, err) => {
    console.error(`[Execution] Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
    console.log(`[Execution] Job ${job.id} completed`);
});

// ---- Public API ----
export async function enqueueExecution(request: ExecutionRequest): Promise<string> {
    const job = await executionQueue.add('execute', request, {
        removeOnComplete: 100,
        removeOnFail: 100,
    });

    resultStore.set(job.id!, {
        jobId: job.id!,
        status: 'queued',
    });

    return job.id!;
}

export function getExecutionResult(jobId: string): ExecutionResult | undefined {
    return resultStore.get(jobId);
}

// Direct execution without queue (for quick runs)
export async function executeDirectly(request: ExecutionRequest): Promise<ExecutionResult> {
    const langConfig = LANG_MAP[request.language.toLowerCase()];
    if (!langConfig) {
        return {
            jobId: 'direct',
            status: 'failed',
            error: `Unsupported language: ${request.language}. Supported: ${Object.keys(LANG_MAP).join(', ')}`,
        };
    }

    const startTime = Date.now();

    try {
        console.log(`[Execution] Calling Piston at ${PISTON_URL}/api/v2/execute`);
        const response = await fetch(`${PISTON_URL}/api/v2/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: langConfig.language,
                version: langConfig.version,
                files: [{ content: request.code }],
                stdin: request.stdin || '',
                args: request.args || [],
                run_timeout: 3000,
                compile_timeout: 3000,
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`[Execution] Piston returned error ${response.status}: ${text}`);
            return {
                jobId: 'direct',
                status: 'failed',
                error: `Piston API error (${response.status}): ${text}`,
                executionTime: Date.now() - startTime,
            };
        }

        const data = await response.json();
        return {
            jobId: 'direct',
            status: 'completed',
            stdout: data.run?.stdout || '',
            stderr: data.run?.stderr || data.compile?.stderr || '',
            exitCode: data.run?.code ?? -1,
            executionTime: Date.now() - startTime,
        };
    } catch (error: any) {
        console.error(`[Execution] Fetch to Piston failed:`, error.message);
        return {
            jobId: 'direct',
            status: 'failed',
            error: error.message,
            executionTime: Date.now() - startTime,
        };
    }
}

export { executionQueue, worker };
