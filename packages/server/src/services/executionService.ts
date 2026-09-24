// Execution backends:
//  - Piston (self-hosted) when PISTON_URL is set, e.g. the docker-compose instance at http://localhost:2000/api/v2
//  - Wandbox (https://wandbox.org, free, no key) otherwise. The public emkc.org Piston API is whitelist-only.
const PISTON_URL = process.env.PISTON_URL?.replace(/\/$/, '');
const WANDBOX_URL = (process.env.WANDBOX_URL || 'https://wandbox.org/api').replace(/\/$/, '');
const EXECUTION_TIMEOUT_MS = 30_000;
console.log(`[Execution] Backend: ${PISTON_URL ? `Piston (${PISTON_URL})` : `Wandbox (${WANDBOX_URL})`}`);

interface LangConfig {
    piston: { language: string; version: string };
    // Wandbox language name as listed in /list.json, plus a fallback compiler if the list can't be fetched
    wandbox: { language: string; fallback: string };
}

const PYTHON: LangConfig     = { piston: { language: 'python', version: '3.10.0' },      wandbox: { language: 'Python', fallback: 'cpython-3.12.7' } };
const JAVASCRIPT: LangConfig = { piston: { language: 'javascript', version: '18.15.0' }, wandbox: { language: 'JavaScript', fallback: 'nodejs-20.17.0' } };
const TYPESCRIPT: LangConfig = { piston: { language: 'typescript', version: '5.0.3' },  wandbox: { language: 'TypeScript', fallback: 'typescript-5.6.2' } };
const JAVA: LangConfig       = { piston: { language: 'java', version: '15.0.2' },       wandbox: { language: 'Java', fallback: 'openjdk-jdk-22+36' } };
const C: LangConfig          = { piston: { language: 'c', version: '10.2.0' },          wandbox: { language: 'C', fallback: 'gcc-13.2.0-c' } };
const CPP: LangConfig        = { piston: { language: 'c++', version: '10.2.0' },        wandbox: { language: 'C++', fallback: 'gcc-13.2.0' } };
const GO: LangConfig         = { piston: { language: 'go', version: '1.16.2' },         wandbox: { language: 'Go', fallback: 'go-1.23.2' } };
const RUST: LangConfig       = { piston: { language: 'rust', version: '1.68.2' },       wandbox: { language: 'Rust', fallback: 'rust-1.82.0' } };
const BASH: LangConfig       = { piston: { language: 'bash', version: '5.2.0' },        wandbox: { language: 'Bash script', fallback: 'bash' } };

const LANG_MAP: Record<string, LangConfig> = {
    python: PYTHON, py: PYTHON,
    javascript: JAVASCRIPT, js: JAVASCRIPT, node: JAVASCRIPT,
    typescript: TYPESCRIPT, ts: TYPESCRIPT,
    java: JAVA,
    c: C,
    cpp: CPP, 'c++': CPP,
    go: GO,
    rust: RUST,
    bash: BASH, shell: BASH,
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
    // Results are fetched once by the client; don't let the map grow forever
    setTimeout(() => resultStore.delete(jobId), 10 * 60_000).unref();
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
        const result = PISTON_URL
            ? await runOnPiston(langConfig, request)
            : await runOnWandbox(langConfig, request);
        return { ...result, jobId: 'direct', executionTime: Date.now() - startTime };
    } catch (error: any) {
        return {
            jobId: 'direct',
            status: 'failed',
            error: error.name === 'TimeoutError' ? 'Execution timed out' : error.message,
            executionTime: Date.now() - startTime,
        };
    }
}

type BackendResult = Omit<ExecutionResult, 'jobId' | 'executionTime'>;

async function runOnPiston(langConfig: LangConfig, request: ExecutionRequest): Promise<BackendResult> {
    const response = await fetch(`${PISTON_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
        body: JSON.stringify({
            language: langConfig.piston.language,
            version: langConfig.piston.version,
            files: [{ content: request.code }],
            stdin: request.stdin || '',
            args: request.args || [],
            run_timeout: 3000,
            compile_timeout: 3000,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        return { status: 'failed', error: `Piston API error (${response.status}): ${text}` };
    }

    const data = await response.json();
    return {
        status: 'completed',
        stdout: data.run?.stdout || '',
        stderr: data.run?.stderr || data.compile?.stderr || '',
        exitCode: data.run?.code ?? -1,
    };
}

// Wandbox renames compilers as versions change, so resolve the newest stable one per language from its list
let wandboxCompilers: Promise<Map<string, string>> | null = null;

function getWandboxCompilers(): Promise<Map<string, string>> {
    if (!wandboxCompilers) {
        wandboxCompilers = fetch(`${WANDBOX_URL}/list.json`, { signal: AbortSignal.timeout(10_000) })
            .then(r => {
                if (!r.ok) throw new Error(`Wandbox list error (${r.status})`);
                return r.json();
            })
            .then((list: { name: string; language: string }[]) => {
                const byLanguage = new Map<string, string>();
                for (const c of list) {
                    // Skip unreleased toolchains (e.g. gcc-head, cpython-head)
                    if (c.name.includes('head') || byLanguage.has(c.language)) continue;
                    byLanguage.set(c.language, c.name);
                }
                return byLanguage;
            })
            .catch(err => {
                console.warn('[Execution] Could not load Wandbox compiler list, using fallbacks:', err.message);
                wandboxCompilers = null; // retry on next request
                return new Map<string, string>();
            });
    }
    return wandboxCompilers;
}

async function runOnWandbox(langConfig: LangConfig, request: ExecutionRequest): Promise<BackendResult> {
    const compilers = await getWandboxCompilers();
    const compiler = compilers.get(langConfig.wandbox.language) || langConfig.wandbox.fallback;

    let code = request.code;
    // Wandbox saves Java source as prog.java, so a top-level `public class` fails to compile
    if (langConfig === JAVA) code = code.replace(/(^|\n)(\s*)public\s+((?:final\s+|abstract\s+)*class\s)/, '$1$2$3');

    const response = await fetch(`${WANDBOX_URL}/compile.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
        body: JSON.stringify({
            compiler,
            code,
            stdin: request.stdin || '',
            'runtime-option-raw': (request.args || []).join('\n'),
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        return { status: 'failed', error: `Wandbox API error (${response.status}): ${text}` };
    }

    const data = await response.json();
    const exitCode = data.status !== undefined && data.status !== '' ? Number(data.status) : -1;
    return {
        status: 'completed',
        stdout: data.program_output || '',
        stderr: [data.compiler_error, data.program_error, data.signal && `Killed by ${data.signal}`].filter(Boolean).join(''),
        exitCode: Number.isNaN(exitCode) ? -1 : exitCode,
    };
}
