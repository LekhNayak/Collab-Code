const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston';
console.log(`[Execution] Piston URL: ${PISTON_URL}`);

const LANG_MAP: Record<string, { language: string; version: string }> = {
    python:     { language: 'python',     version: '3.10.0'  },
    py:         { language: 'python',     version: '3.10.0'  },
    javascript: { language: 'javascript', version: '18.15.0' },
    js:         { language: 'javascript', version: '18.15.0' },
    node:       { language: 'javascript', version: '18.15.0' },
    typescript: { language: 'typescript', version: '5.0.3'   },
    ts:         { language: 'typescript', version: '5.0.3'   },
    java:       { language: 'java',       version: '15.0.2'  },
    c:          { language: 'c',          version: '10.2.0'  },
    cpp:        { language: 'c++',        version: '10.2.0'  },
    'c++':      { language: 'c++',        version: '10.2.0'  },
    go:         { language: 'go',         version: '1.16.2'  },
    rust:       { language: 'rust',       version: '1.68.2'  },
    bash:       { language: 'bash',       version: '5.2.0'   },
    shell:      { language: 'bash',       version: '5.2.0'   },
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

const resultStore = new Map<string, ExecutionResult>();

// Thin wrapper so the /run (queued) route still works — runs directly, no Redis needed
export async function enqueueExecution(request: ExecutionRequest): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    resultStore.set(jobId, { jobId, status: 'running' });
    const result = await executeDirectly(request);
    resultStore.set(jobId, { ...result, jobId });
    return jobId;
}

export function getExecutionResult(jobId: string): ExecutionResult | undefined {
    return resultStore.get(jobId);
}

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
        const response = await fetch(`${PISTON_URL}/execute`, {
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
        return {
            jobId: 'direct',
            status: 'failed',
            error: error.message,
            executionTime: Date.now() - startTime,
        };
    }
}
