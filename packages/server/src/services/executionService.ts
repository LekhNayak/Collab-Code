// Execution backends:
//  - Piston (self-hosted) when PISTON_URL is set, e.g. the docker-compose instance at http://localhost:2000/api/v2
//  - Wandbox (https://wandbox.org, free, no key) otherwise. The public emkc.org Piston API is whitelist-only.
const PISTON_URL = process.env.PISTON_URL?.replace(/\/$/, '');
const WANDBOX_URL = (process.env.WANDBOX_URL || 'https://wandbox.org/api').replace(/\/$/, '');
const EXECUTION_TIMEOUT_MS = 30_000;
console.log(`[Execution] Backend: ${PISTON_URL ? `Piston (${PISTON_URL})` : `Wandbox (${WANDBOX_URL})`}`);

interface LangConfig {
    piston: { language: string; version: string };
    // Wandbox language name as listed in /list.json, plus a fallback compiler if the list can't be fetched,
    // and roughly how long Wandbox takes to compile it (judging can't separate compile time from run time there)
    wandbox: { language: string; fallback: string; compileMs: number };
}

const PYTHON: LangConfig     = { piston: { language: 'python', version: '3.10.0' },      wandbox: { language: 'Python', fallback: 'cpython-3.12.7', compileMs: 0 } };
const JAVASCRIPT: LangConfig = { piston: { language: 'javascript', version: '18.15.0' }, wandbox: { language: 'JavaScript', fallback: 'nodejs-20.17.0', compileMs: 0 } };
const TYPESCRIPT: LangConfig = { piston: { language: 'typescript', version: '5.0.3' },  wandbox: { language: 'TypeScript', fallback: 'typescript-5.6.2', compileMs: 8000 } };
const JAVA: LangConfig       = { piston: { language: 'java', version: '15.0.2' },       wandbox: { language: 'Java', fallback: 'openjdk-jdk-22+36', compileMs: 8000 } };
const C: LangConfig          = { piston: { language: 'c', version: '10.2.0' },          wandbox: { language: 'C', fallback: 'gcc-13.2.0-c', compileMs: 5000 } };
const CPP: LangConfig        = { piston: { language: 'c++', version: '10.2.0' },        wandbox: { language: 'C++', fallback: 'gcc-13.2.0', compileMs: 10000 } };
const GO: LangConfig         = { piston: { language: 'go', version: '1.16.2' },         wandbox: { language: 'Go', fallback: 'go-1.23.2', compileMs: 15000 } };
const RUST: LangConfig       = { piston: { language: 'rust', version: '1.68.2' },       wandbox: { language: 'Rust', fallback: 'rust-1.82.0', compileMs: 20000 } };
const BASH: LangConfig       = { piston: { language: 'bash', version: '5.2.0' },        wandbox: { language: 'Bash script', fallback: 'bash', compileMs: 0 } };

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

// The public Wandbox API accepts about 10 requests per minute per IP and answers 429 beyond that, and every
// user of this server shares one IP. Pace our own requests so they wait in line instead of failing.
// Lower priority numbers go first (interactive runs before judging).
const WANDBOX_RATE_PER_MIN = Number(process.env.WANDBOX_RATE_PER_MIN) || 9;

class RateGate {
    private sent: number[] = [];
    private waiting: Array<{ priority: number; resolve: () => void }> = [];
    private timer: NodeJS.Timeout | null = null;

    constructor(private readonly perMinute: number) {}

    acquire(priority: number): Promise<void> {
        return new Promise(resolve => {
            this.waiting.push({ priority, resolve });
            this.waiting.sort((a, b) => a.priority - b.priority); // stable: FIFO within a priority
            this.drain();
        });
    }

    // After a 429, treat the current minute as used up
    saturate() {
        const now = Date.now();
        while (this.sent.length < this.perMinute) this.sent.push(now);
        this.drain();
    }

    get queued() {
        return this.waiting.length;
    }

    private drain() {
        const now = Date.now();
        this.sent = this.sent.filter(t => now - t < 60_000);
        while (this.waiting.length > 0 && this.sent.length < this.perMinute) {
            this.sent.push(now);
            this.waiting.shift()!.resolve();
        }
        if (this.waiting.length > 0 && !this.timer) {
            const wait = 60_000 - (now - Math.min(...this.sent)) + 50;
            this.timer = setTimeout(() => {
                this.timer = null;
                this.drain();
            }, wait);
        }
    }
}

const wandboxGate = new RateGate(WANDBOX_RATE_PER_MIN);
export const executionBacklog = () => (PISTON_URL ? 0 : wandboxGate.queued);

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

    await wandboxGate.acquire(0);
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
        if (response.status === 429) wandboxGate.saturate();
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

// ─── Judging (contests) ─────────────────────────────────────────────────────
// runForJudge classifies a single test run. Unlike executeDirectly it separates compile errors from
// runtime errors and applies the problem's time limit.
//  - Piston enforces real CPU/wall time and memory limits (capped by the Piston host's own limits).
//  - Wandbox can't take limits, so a run is cut off at timeLimit + the language's compile allowance +
//    WANDBOX_OVERHEAD_MS (network and startup) and reported as an approximate TLE.

export const judgeBackend: 'piston' | 'wandbox' = PISTON_URL ? 'piston' : 'wandbox';
// Piston rejects limits above its configured maximum (PISTON_RUN_TIMEOUT on the Piston host, default 3s)
export const PISTON_MAX_RUN_MS = Number(process.env.PISTON_MAX_RUN_MS) || 3000;
const WANDBOX_OVERHEAD_MS = Number(process.env.WANDBOX_OVERHEAD_MS) || 4000;
const PISTON_COMPILE_TIMEOUT_MS = 10_000;
// Program output larger than this is treated as "output limit exceeded"
const MAX_JUDGE_OUTPUT = 4 * 1024 * 1024;

export type JudgeKind = 'ok' | 'ce' | 're' | 'tle' | 'mle' | 'ole' | 'ie';

export interface JudgeRequest {
    code: string;
    language: string;
    stdin: string;
    timeLimitMs: number;
    memoryLimitMb?: number | null;
    priority?: number;    // Wandbox queue order: 0 = interactive run (default), 1 = judging
}

export interface JudgeRun {
    kind: JudgeKind;
    stdout: string;
    stderr: string;
    compileOutput?: string;
    exitCode?: number;
    signal?: string;
    timeMs: number;
    timeExact: boolean;   // false on Wandbox: wall-clock including network and compilation
    retryable?: boolean;  // 'ie' caused by the backend being unavailable (5xx, 429, network)
    message?: string;     // 'ie' details
}

export const isSupportedLanguage = (language: string) => !!LANG_MAP[language.toLowerCase()];

export async function runForJudge(request: JudgeRequest): Promise<JudgeRun> {
    const langConfig = LANG_MAP[request.language.toLowerCase()];
    const startTime = Date.now();
    if (!langConfig) {
        return { kind: 'ie', stdout: '', stderr: '', timeMs: 0, timeExact: false, message: `Unsupported language: ${request.language}` };
    }
    try {
        return PISTON_URL
            ? await judgeOnPiston(langConfig, request, startTime)
            : await judgeOnWandbox(langConfig, request);
    } catch (error: any) {
        // Network failure or our 30s safety timeout on Piston: the backend is unavailable, not the program's fault
        return { kind: 'ie', stdout: '', stderr: '', timeMs: Date.now() - startTime, timeExact: false, retryable: true, message: error.message };
    }
}

async function readJudgeResponse(response: Response, startTime: number): Promise<{ data?: any; failure?: JudgeRun }> {
    const timeMs = Date.now() - startTime;
    if (!response.ok) {
        const text = (await response.text()).slice(0, 500);
        const retryable = response.status >= 500 || response.status === 429;
        return { failure: { kind: 'ie', stdout: '', stderr: '', timeMs, timeExact: false, retryable, message: `Execution backend error (${response.status}): ${text}` } };
    }
    const text = await response.text();
    if (text.length > 2 * MAX_JUDGE_OUTPUT) {
        return { failure: { kind: 'ole', stdout: '', stderr: '', timeMs, timeExact: false } };
    }
    return { data: JSON.parse(text) };
}

async function judgeOnPiston(langConfig: LangConfig, request: JudgeRequest, startTime: number): Promise<JudgeRun> {
    const runMs = Math.min(request.timeLimitMs, PISTON_MAX_RUN_MS);
    const response = await fetch(`${PISTON_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(EXECUTION_TIMEOUT_MS),
        body: JSON.stringify({
            language: langConfig.piston.language,
            version: langConfig.piston.version,
            files: [{ content: request.code }],
            stdin: request.stdin,
            args: [],
            run_timeout: runMs,
            run_cpu_time: runMs,
            compile_timeout: PISTON_COMPILE_TIMEOUT_MS,
            compile_cpu_time: PISTON_COMPILE_TIMEOUT_MS,
            ...(request.memoryLimitMb ? { run_memory_limit: request.memoryLimitMb * 1024 * 1024 } : {}),
        }),
    });
    const { data, failure } = await readJudgeResponse(response, startTime);
    if (failure) return failure;

    const measured = Date.now() - startTime;
    // When compilation fails Piston skips the run stage and copies `compile` into `run`, so check compile first
    const compile = data.compile;
    if (compile && (compile.code !== 0 || compile.status || compile.signal)) {
        return { kind: 'ce', stdout: '', stderr: '', compileOutput: compile.stderr || compile.output || '', timeMs: measured, timeExact: false };
    }

    const run = data.run || {};
    const stdout: string = run.stdout || '';
    const stderr: string = run.stderr || '';
    const timeMs = run.cpu_time ?? run.wall_time ?? measured;
    const base = { stdout, stderr, exitCode: run.code ?? undefined, signal: run.signal ?? undefined, timeMs, timeExact: run.cpu_time != null };

    if (stdout.length > MAX_JUDGE_OUTPUT) return { ...base, kind: 'ole' };
    switch (run.status) {
        case 'TO': return { ...base, kind: 'tle' };
        case 'OL':
        case 'EL': return { ...base, kind: 'ole' };
        case 'XX': return { ...base, kind: 'ie', message: run.message || 'Internal error in the sandbox' };
    }
    if (run.signal === 'SIGKILL' && request.memoryLimitMb && run.memory != null && run.memory >= 0.95 * request.memoryLimitMb * 1024 * 1024) {
        return { ...base, kind: 'mle' };
    }
    // Older Piston images report no status: a SIGKILL near the time limit is a timeout
    if (!run.status && run.signal === 'SIGKILL' && measured >= 0.8 * runMs) return { ...base, kind: 'tle' };
    if (run.status === 'SG' || run.status === 'RE' || run.signal || (run.code ?? 0) !== 0) return { ...base, kind: 're' };
    return { ...base, kind: 'ok' };
}

async function judgeOnWandbox(langConfig: LangConfig, request: JudgeRequest): Promise<JudgeRun> {
    const compilers = await getWandboxCompilers();
    const compiler = compilers.get(langConfig.wandbox.language) || langConfig.wandbox.fallback;

    let code = request.code;
    // Wandbox saves Java source as prog.java, so a top-level `public class` fails to compile
    if (langConfig === JAVA) code = code.replace(/(^|\n)(\s*)public\s+((?:final\s+|abstract\s+)*class\s)/, '$1$2$3');

    await wandboxGate.acquire(request.priority ?? 0);
    // Time the run itself, not the wait for a free Wandbox slot
    const startTime = Date.now();
    let response: Response;
    try {
        response = await fetch(`${WANDBOX_URL}/compile.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(request.timeLimitMs + langConfig.wandbox.compileMs + WANDBOX_OVERHEAD_MS),
            body: JSON.stringify({ compiler, code, stdin: request.stdin }),
        });
    } catch (error: any) {
        // Our own cut-off at the time limit (Wandbox can't enforce one)
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return { kind: 'tle', stdout: '', stderr: '', timeMs: Date.now() - startTime, timeExact: false };
        }
        throw error;
    }
    if (response.status === 429) wandboxGate.saturate();
    const { data, failure } = await readJudgeResponse(response, startTime);
    if (failure) return failure;

    const timeMs = Date.now() - startTime;
    const stdout: string = data.program_output || '';
    const stderr: string = data.program_error || '';
    const status = data.status !== undefined && data.status !== '' ? String(data.status) : '';
    const exitCode = status !== '' && !Number.isNaN(Number(status)) ? Number(status) : undefined;
    const signal: string | undefined = data.signal || undefined;
    // Wandbox always sends the program_* fields; they're empty when compilation failed
    const ran = !!(stdout || stderr);
    const base = { stdout, stderr, exitCode, signal, timeMs, timeExact: false };

    // Compiler warnings alone don't count: only a failed status with no program output
    if (status !== '0' && data.compiler_error && !ran && !signal) {
        return { ...base, kind: 'ce', compileOutput: data.compiler_error };
    }
    // Python reports syntax errors at run time; treat them as compile errors so judging stops early
    if (langConfig === PYTHON && !stdout && /\b(SyntaxError|IndentationError|TabError)\b/.test(stderr)) {
        return { ...base, kind: 'ce', compileOutput: stderr };
    }
    if (stdout.length > MAX_JUDGE_OUTPUT) return { ...base, kind: 'ole' };
    if (signal) return { ...base, kind: /kill|cpu time|xcpu/i.test(signal) ? 'tle' : 're' };
    if (status !== '0') return { ...base, kind: 're' };
    return { ...base, kind: 'ok' };
}
