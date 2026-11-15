// REST client for /contests (see packages/server/src/routes/contests.ts)

import { API_BASE } from './config';
import { apiFetch } from './api';
import type { ContestLanguageInfo } from './contest/languages';

export type Phase = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED';
export type Verdict = 'AC' | 'PARTIAL' | 'WA' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'OLE' | 'IE' | 'SKIPPED';
export type SubmissionStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'ERROR';
export type ParticipantStatus = 'ACTIVE' | 'BLOCKED' | 'REMOVED';
export type ProblemKind = 'CODE' | 'SQL';

// SQL problems: a query result or a table of a dataset (BLOBs arrive as X'..' literals)
export type SqlValue = string | number | null;
export interface SqlTable {
    columns: string[];
    rows: SqlValue[][];
    totalRows?: number; // rows before clipping (only the first 50 are sent)
}
export interface NamedSqlTable extends SqlTable {
    name: string;
}

export interface ContestSummary {
    id: string;
    code: string;
    title: string;
    description: string;
    startsAt: string | null;
    endsAt: string | null;
    durationMinutes: number;
    phase: Phase;
    proctoring: boolean;
    maxTabSwitches: number;
    leaderboard: 'LIVE' | 'AFTER_END';
    languages: ContestLanguageInfo[];
    allowedLanguageIds: string[];
}

export interface TestMeta {
    id: string;
    isSample: boolean;
    order: number;
    inputPreview: string;
    inputSize: number;
    outputPreview: string;
    outputSize: number;
    expectedRows: number | null; // SQL problems: rows in the expected result
}

export interface AdminProblem {
    id: string;
    index: string;
    title: string;
    statement: string;
    points: number;
    timeLimitMs: number;
    memoryLimitMb: number | null;
    kind: ProblemKind;
    sqlSchema: string;
    sqlSolution: string;
    sqlOrderMatters: boolean;
    tests: TestMeta[];
}

export interface TestCase {
    id: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
    order: number;
}

export interface ParticipantProblem {
    id: string;
    index: string;
    title: string;
    statement: string;
    points: number;
    timeLimitMs: number;
    memoryLimitMb: number | null;
    kind: ProblemKind;
    sqlSchema?: string;     // SQL problems
    orderMatters?: boolean; // SQL problems: rows must come in the expected order
    samples: {
        input: string;
        expectedOutput: string;
        // SQL problems: the dataset's tables and the expected result
        tables?: NamedSqlTable[];
        tablesError?: string;
        expected?: SqlTable | null;
    }[];
    testCount: number;
}

export interface TestResult {
    verdict: Verdict;
    timeMs: number | null;
    timeExact: boolean;
    sample: boolean;
    stdout?: string;
    stderr?: string;
    table?: SqlTable | null; // SQL problems (sample tests)
}

export interface SubmissionSummary {
    id: string;
    problemId: string;
    language: string;
    status: SubmissionStatus;
    verdict: Verdict | null;
    passed: number;
    total: number;
    score: number;
    createdAt: string;
    finishedAt?: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
    code: string;
    results: TestResult[];
    compileOutput: string | null;
    queuePosition: number | null;
    userId: string;
    user: { username: string };
    problem: { index: string; title: string };
}

export interface LeaderboardRow {
    rank: number;
    userId: string;
    username: string;
    status: ParticipantStatus;
    total: number;
    reachedAt: string | null;
    problems: Record<string, { score: number; at: string }>;
}

export interface LeaderboardProblem {
    id: string;
    index: string;
    title: string;
    points: number;
}

export interface SampleRunResult {
    verdict: Verdict;
    stdout: string;
    stderr: string;
    timeMs: number;
    timeExact: boolean;
    input: string;
    expected: string;
    message?: string;
    table?: SqlTable | null;         // SQL problems
    expectedTable?: SqlTable | null; // SQL problems
}

export type RunResponse =
    | { mode: 'samples'; results: SampleRunResult[]; compileOutput: string | null; totalSamples: number }
    | { mode: 'custom'; kind: string; stdout: string; stderr: string; compileOutput: string; timeMs: number; timeExact: boolean; message?: string; table?: SqlTable | null };

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const isForm = body instanceof FormData;
    const res = await apiFetch(`${API_BASE}/contests${path}`, {
        method,
        headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(data.error || `Request failed (${res.status})`) as Error & { status?: number };
        error.status = res.status;
        throw error;
    }
    return data as T;
}

export type ContestSettings = Partial<Pick<ContestSummary, 'title' | 'description' | 'durationMinutes' | 'proctoring' | 'maxTabSwitches' | 'leaderboard'>> & {
    languages?: string[];
};

export const contestApi = {
    // Organizer
    create: (settings: ContestSettings) => request<ContestSummary>('POST', '', settings),
    mine: () => request<{ owned: (ContestSummary & { problemCount: number; participantCount: number })[]; joined: (ContestSummary & { organizer: string; status: ParticipantStatus })[]; serverNow: string }>('GET', '/mine'),
    admin: (id: string) => request<{ contest: ContestSummary; problems: AdminProblem[]; participantCount: number; submissionCount: number; serverNow: string }>('GET', `/${id}/admin`),
    update: (id: string, settings: ContestSettings) => request<ContestSummary>('PATCH', `/${id}`, settings),
    start: (id: string, at?: string) => request<ContestSummary>('POST', `/${id}/start`, at ? { at } : {}),
    unschedule: (id: string) => request<ContestSummary>('POST', `/${id}/unschedule`),
    end: (id: string) => request<ContestSummary>('POST', `/${id}/end`),
    remove: (id: string) => request<{ message: string }>('DELETE', `/${id}`),
    judgeInfo: (id: string) => request<{ backend: 'piston' | 'wandbox'; concurrency: number; stopAfterTle: boolean; maxTimeLimitMs: number; maxTestsPerProblem: number; languages: ContestLanguageInfo[]; sql: { engine: string; maxTimeLimitMs: number; memoryLimitMb: number } }>('GET', `/${id}/judge-info`),

    addProblem: (id: string, problem: Partial<AdminProblem>) => request<AdminProblem>('POST', `/${id}/problems`, problem),
    updateProblem: (id: string, problemId: string, problem: Partial<AdminProblem>) => request<AdminProblem>('PATCH', `/${id}/problems/${problemId}`, problem),
    deleteProblem: (id: string, problemId: string) => request<{ message: string }>('DELETE', `/${id}/problems/${problemId}`),
    rejudgeProblem: (id: string, problemId: string) => request<{ requeued: number }>('POST', `/${id}/problems/${problemId}/rejudge`),

    getTest: (id: string, problemId: string, testId: string) => request<TestCase>('GET', `/${id}/problems/${problemId}/tests/${testId}`),
    addTest: (id: string, problemId: string, test: Partial<TestCase>) => request<TestCase>('POST', `/${id}/problems/${problemId}/tests`, test),
    updateTest: (id: string, problemId: string, testId: string, test: Partial<TestCase>) => request<TestCase>('PATCH', `/${id}/problems/${problemId}/tests/${testId}`, test),
    deleteTest: (id: string, problemId: string, testId: string) => request<{ message: string }>('DELETE', `/${id}/problems/${problemId}/tests/${testId}`),
    uploadTests: (id: string, problemId: string, files: File[], mode: 'append' | 'replace', sampleCount?: number) => {
        const form = new FormData();
        files.forEach(f => {
            form.append('files', f);
            form.append('paths', f.webkitRelativePath || f.name);
        });
        form.append('mode', mode);
        if (sampleCount !== undefined) form.append('sampleCount', String(sampleCount));
        return request<{ added: number; samples: number; names: string[] }>('POST', `/${id}/problems/${problemId}/tests/upload`, form);
    },

    monitor: (id: string) => request<MonitorData>('GET', `/${id}/monitor`),
    participantAction: (id: string, userId: string, action: 'block' | 'unblock' | 'remove', reason?: string) =>
        request<{ status: ParticipantStatus }>('POST', `/${id}/participants/${userId}/${action}`, reason ? { reason } : {}),
    rejudgeSubmission: (id: string, submissionId: string) => request<{ requeued: number }>('POST', `/${id}/submissions/${submissionId}/rejudge`),

    // Participant
    resolve: (code: string) => request<ResolveResponse>('GET', `/resolve/${encodeURIComponent(code)}`),
    join: (id: string) => request<{ status?: ParticipantStatus; isOwner?: boolean }>('POST', `/${id}/join`),
    problems: (id: string) => request<{ problems: ParticipantProblem[]; judge: { backend: string }; serverNow: string }>('GET', `/${id}/problems`),
    open: (id: string, problemId: string, language: string) => request<{ path: string; readOnly: boolean }>('POST', `/${id}/open`, { problemId, language }),
    runSamples: (id: string, problemId: string, language: string, code: string) =>
        request<RunResponse>('POST', `/${id}/run`, { problemId, language, code, mode: 'samples' }),
    runCustom: (id: string, problemId: string, language: string, code: string, stdin: string) =>
        request<RunResponse>('POST', `/${id}/run`, { problemId, language, code, mode: 'custom', stdin }),
    submit: (id: string, problemId: string, language: string, code: string) =>
        request<{ id: string; status: SubmissionStatus; createdAt: string }>('POST', `/${id}/submit`, { problemId, language, code }),
    submissions: (id: string, problemId?: string) =>
        request<{ submissions: SubmissionSummary[]; serverNow: string }>('GET', `/${id}/submissions${problemId ? `?problem=${encodeURIComponent(problemId)}` : ''}`),
    submission: (id: string, submissionId: string) => request<SubmissionDetail>('GET', `/${id}/submissions/${submissionId}`),
    leaderboard: (id: string) => request<{ hidden: boolean; problems: LeaderboardProblem[]; rows: LeaderboardRow[]; serverNow: string }>('GET', `/${id}/leaderboard`),
    proctor: (id: string, type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'PASTE', length?: number) =>
        request<{ blocked: boolean; reason?: string | null; tabSwitchCount?: number; maxTabSwitches?: number; ignored?: boolean }>('POST', `/${id}/proctor`, { type, length }),
};

export interface ResolveResponse {
    contest: ContestSummary & { organizer: string; problemCount: number; participantCount: number };
    isOwner: boolean;
    isGuest: boolean;
    participant: { status: ParticipantStatus; tabSwitchCount: number; blockedReason: string | null } | null;
    serverNow: string;
}

export interface MonitorData {
    contest: ContestSummary;
    problems: LeaderboardProblem[];
    participants: { userId: string; username: string; status: ParticipantStatus; tabSwitchCount: number; blockedReason: string | null; joinedAt: string }[];
    leaderboard: LeaderboardRow[];
    events: { id: string; type: string; userId: string | null; username: string | null; details: Record<string, unknown> | null; createdAt: string }[];
    submissions: (SubmissionSummary & { userId: string; username: string })[];
    judge: { backend: string; queued: number; backlog: number };
    serverNow: string;
}

// ─── Display helpers ────────────────────────────────────────────────────────

export const VERDICT_LABEL: Record<Verdict, string> = {
    AC: 'Accepted',
    PARTIAL: 'Partially accepted',
    WA: 'Wrong answer',
    TLE: 'Time limit exceeded',
    MLE: 'Memory limit exceeded',
    RE: 'Runtime error',
    CE: 'Compilation error',
    OLE: 'Output limit exceeded',
    IE: 'Judge error',
    SKIPPED: 'Skipped',
};

// Tailwind classes per verdict (text + background). Status colors only: green passed, red failed,
// amber partial or out of budget, gray for the judge's own states.
const OK = 'text-success-text bg-success/15';
const WARN = 'text-warning-text bg-warning/15';
const FAIL = 'text-danger-text bg-danger/15';
const QUIET = 'text-fg-2 bg-tint-2';
export const VERDICT_STYLE: Record<Verdict, string> = {
    AC: OK,
    PARTIAL: WARN,
    WA: FAIL,
    TLE: WARN,
    MLE: WARN,
    RE: FAIL,
    CE: FAIL,
    OLE: WARN,
    IE: QUIET,
    SKIPPED: 'text-fg-3 bg-tint-1',
};

export const PHASE_LABEL: Record<Phase, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    LIVE: 'Live',
    ENDED: 'Ended',
};

export const PHASE_STYLE: Record<Phase, string> = {
    DRAFT: QUIET,
    SCHEDULED: 'text-accent-text bg-accent/15',
    LIVE: OK,
    ENDED: 'text-fg-3 bg-tint-1',
};

export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const formatScore = (score: number) => (Number.isInteger(score) ? String(score) : score.toFixed(2));

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));
