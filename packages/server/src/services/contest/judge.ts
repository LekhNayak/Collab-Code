// Judges contest submissions: runs every test case of the problem one by one and scores the result.
//
// The Submission table is the queue, so nothing is lost when the server restarts (Render free plan):
//  - a submission is claimed by moving it QUEUED -> RUNNING; its startedAt is the claim token
//  - after every test the row is updated, which also serves as a heartbeat (updatedAt)
//  - on boot and periodically, RUNNING rows that stopped moving go back to QUEUED and start over
//    (createdAt is kept, so rankings don't change)

import type { Prisma, Problem, Submission, TestCase, Verdict } from '@prisma/client';
import prisma from '../../db';
import { runForJudge, judgeBackend, type JudgeRun } from '../executionService';
import { clip, clipTable, outputsMatch, overallVerdict, parseSqlTable, resultsMatch, scoreFor, type SqlTable } from './verdict';
import { runSql, type SqlRun } from './sqlRunner';
import { invalidateLeaderboard } from './leaderboard';

const CONCURRENCY = Number(process.env.JUDGE_CONCURRENCY) || (judgeBackend === 'piston' ? 4 : 2);
// After a TLE the remaining tests are skipped (counted as failed). On by default on Wandbox, where every
// timed-out test costs several seconds and a share of the shared rate limit.
const STOP_AFTER_TLE = process.env.JUDGE_STOP_AFTER_TLE
    ? process.env.JUDGE_STOP_AFTER_TLE !== 'false'
    : judgeBackend === 'wandbox';
const STALE_AFTER_MS = 2 * 60_000;
// Progress (which doubles as the heartbeat) is written at most this often: SQL tests take milliseconds
// each, and a write per test would make the database the slowest part of judging
const PROGRESS_SAVE_MS = 1_000;
const RETRY_DELAYS_MS = [3_000, 15_000];

// Wandbox queue priority (see executionService): interactive runs go before judging
export const PRIORITY_INTERACTIVE = 0;
const PRIORITY_JUDGE = 1;

export interface TestResult {
    verdict: Verdict;
    timeMs: number | null;
    timeExact: boolean;
    sample: boolean;
    // Only kept for sample tests; participants never see anything of hidden tests but the verdict
    stdout?: string;
    stderr?: string;
    table?: (SqlTable & { totalRows: number }) | null; // SQL problems: the query's result
}

export function verdictForRun(run: JudgeRun, expected: string): Verdict {
    switch (run.kind) {
        case 'ok': return outputsMatch(run.stdout, expected) ? 'AC' : 'WA';
        case 'ce': return 'CE';
        case 're': return 'RE';
        case 'tle': return 'TLE';
        case 'mle': return 'MLE';
        case 'ole': return 'OLE';
        default: return 'IE';
    }
}

export function verdictForSql(run: SqlRun, expectedJson: string, orderMatters: boolean): Verdict {
    switch (run.kind) {
        case 'ok': {
            const expected = parseSqlTable(expectedJson);
            if (!expected) return 'IE';
            return run.table && resultsMatch(run.table, expected, orderMatters) ? 'AC' : 'WA';
        }
        case 're': return 'RE';
        case 'tle': return 'TLE';
        case 'mle': return 'MLE';
        case 'ole': return 'OLE';
        default: return 'IE'; // setup-error: the organizer's schema or data no longer loads
    }
}

// What to show next to an SQL result: the SQLite error, or why there is no result
export const sqlRunMessage = (run: SqlRun) =>
    run.message ?? (run.kind === 'ok' && !run.table ? "Your query didn't return a result (no SELECT)" : '');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Runs one test, retrying when the execution backend (not the program) failed
async function runTest(request: Parameters<typeof runForJudge>[0]): Promise<JudgeRun> {
    let run = await runForJudge(request);
    for (const delay of RETRY_DELAYS_MS) {
        if (run.kind !== 'ie' || !run.retryable) break;
        await sleep(delay);
        run = await runForJudge(request);
    }
    return run;
}

interface TestOutcome {
    result: TestResult;
    compileOutput?: string; // CE
    failure?: string;       // IE: the execution backend failed
}

async function judgeCodeTest(submission: Submission, problem: Problem, test: TestCase): Promise<TestOutcome> {
    const run = await runTest({
        code: submission.code,
        language: submission.language,
        stdin: test.input,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
        priority: PRIORITY_JUDGE,
    });
    const verdict = verdictForRun(run, test.expectedOutput);
    return {
        result: {
            verdict,
            timeMs: run.kind === 'ce' ? null : run.timeMs,
            timeExact: run.timeExact,
            sample: test.isSample,
            ...(test.isSample ? { stdout: clip(run.stdout), stderr: clip(run.stderr) } : {}),
        },
        compileOutput: verdict === 'CE' ? clip(run.compileOutput) : undefined,
        failure: verdict === 'IE' ? run.message || 'The code runner is unavailable' : undefined,
    };
}

async function judgeSqlTest(submission: Submission, problem: Problem, test: TestCase): Promise<TestOutcome> {
    const request = { schema: problem.sqlSchema, data: test.input, query: submission.code, timeLimitMs: problem.timeLimitMs };
    let run = await runSql(request);
    if (run.kind === 'ie') run = await runSql(request); // a crashed worker: one more try
    const verdict = verdictForSql(run, test.expectedOutput, problem.sqlOrderMatters);
    return {
        result: {
            verdict,
            timeMs: run.timeMs,
            timeExact: true,
            sample: test.isSample,
            ...(test.isSample ? { table: clipTable(run.table), stderr: clip(sqlRunMessage(run)) } : {}),
        },
        failure: verdict === 'IE' ? run.message || 'The test data could not be loaded' : undefined,
    };
}

let accepting = true;
let judging = 0;
let pumping = false;
let pumpAgain = false;

// Claims queued submissions until all judge slots are busy
export function pumpJudge() {
    if (!accepting) return;
    if (pumping) {
        // The running pump may have read the queue before this submission arrived: look again after it,
        // instead of leaving the submission to the 10-second safety net
        pumpAgain = true;
        return;
    }
    pumping = true;
    void (async () => {
        try {
            do {
                pumpAgain = false;
                while (accepting && judging < CONCURRENCY) {
                    const next = await prisma.submission.findFirst({
                        where: { status: 'QUEUED' },
                        orderBy: { createdAt: 'asc' },
                        select: { id: true },
                    });
                    if (!next) break;
                    const claimedAt = new Date();
                    const claim = await prisma.submission.updateMany({
                        where: { id: next.id, status: 'QUEUED' },
                        data: { status: 'RUNNING', startedAt: claimedAt, results: [], passed: 0, verdict: null, compileOutput: null },
                    });
                    if (claim.count !== 1) continue; // someone else got it
                    judging++;
                    judgeSubmission(next.id, claimedAt)
                        .catch(err => console.error(`[Judge] Submission ${next.id} failed:`, err))
                        .finally(() => {
                            judging--;
                            pumpJudge();
                        });
                }
            } while (pumpAgain && accepting);
        } catch (err) {
            console.error('[Judge] Could not read the queue:', err);
        } finally {
            pumping = false;
        }
    })();
}

async function judgeSubmission(id: string, claimedAt: Date) {
    const submission = await prisma.submission.findUnique({
        where: { id },
        include: { problem: { include: { tests: { orderBy: { order: 'asc' } } } } },
    });
    if (!submission) return;
    const { problem } = submission;
    const tests = problem.tests;

    // Only write while we still own the claim (a rejudge or stale recovery may have taken it back)
    const save = async (data: Prisma.SubmissionUpdateManyMutationInput) => {
        const result = await prisma.submission.updateMany({ where: { id, status: 'RUNNING', startedAt: claimedAt }, data });
        return result.count === 1;
    };

    const results: TestResult[] = [];
    let passed = 0;
    let compileOutput: string | null = null;
    let skipRest: Verdict | null = null;
    let backendFailure: string | null = null;
    let lastSave = Date.now();

    for (const test of tests) {
        if (skipRest) {
            results.push({ verdict: skipRest, timeMs: null, timeExact: false, sample: test.isSample });
            continue;
        }
        const outcome = problem.kind === 'SQL'
            ? await judgeSqlTest(submission, problem, test)
            : await judgeCodeTest(submission, problem, test);
        const { verdict } = outcome.result;
        if (verdict === 'AC') passed++;
        results.push(outcome.result);

        if (verdict === 'CE') {
            compileOutput = outcome.compileOutput ?? '';
            skipRest = 'CE'; // the same code won't compile for the other tests either
        } else if (verdict === 'TLE' && STOP_AFTER_TLE) {
            skipRest = 'SKIPPED';
        } else if (verdict === 'IE') {
            backendFailure = outcome.failure ?? 'The code runner is unavailable';
            skipRest = 'SKIPPED';
        }

        if (Date.now() - lastSave >= PROGRESS_SAVE_MS) {
            if (!(await save({ results: results as unknown as Prisma.InputJsonValue, passed }))) return;
            lastSave = Date.now();
        }
    }

    const failed = backendFailure !== null;
    const finished = await save({
        status: failed ? 'ERROR' : 'DONE',
        verdict: failed ? 'IE' : overallVerdict(results.map(r => r.verdict)),
        passed,
        total: tests.length,
        score: failed ? 0 : scoreFor(problem.points, passed, tests.length),
        results: results as unknown as Prisma.InputJsonValue,
        compileOutput: compileOutput ?? (failed ? backendFailure : null),
        finishedAt: new Date(),
    });
    if (finished) invalidateLeaderboard(submission.contestId);
}

// Puts RUNNING submissions whose heartbeat stopped back in the queue. On boot, everything RUNNING
// belongs to a previous process (any instance still working on one loses its claim and stops).
export async function recoverStaleSubmissions(olderThan = new Date(Date.now() - STALE_AFTER_MS)) {
    const { count } = await prisma.submission.updateMany({
        where: { status: 'RUNNING', updatedAt: { lt: olderThan } },
        data: { status: 'QUEUED', startedAt: null, results: [], passed: 0 },
    });
    if (count > 0) console.log(`[Judge] Requeued ${count} interrupted submission(s)`);
    return count;
}

export function startJudge() {
    const bootTime = new Date();
    recoverStaleSubmissions(bootTime)
        .catch(err => console.error('[Judge] Recovery failed:', err))
        .finally(pumpJudge);
    setInterval(() => {
        recoverStaleSubmissions().catch(err => console.error('[Judge] Recovery failed:', err));
    }, 60_000).unref();
    // Safety net in case an enqueue notification was missed
    setInterval(pumpJudge, 10_000).unref();
    console.log(`[Judge] Ready (${judgeBackend}, ${CONCURRENCY} at a time${STOP_AFTER_TLE ? ', stop after TLE' : ''})`);
}

// On shutdown: stop claiming work. Anything in progress is picked up again after the restart.
export function stopJudge() {
    accepting = false;
}

// Position in the queue (1 = next), or null when not queued
export async function queuePosition(submission: { status: string; createdAt: Date }): Promise<number | null> {
    if (submission.status !== 'QUEUED') return null;
    const ahead = await prisma.submission.count({ where: { status: 'QUEUED', createdAt: { lt: submission.createdAt } } });
    return ahead + 1;
}

export const judgeSettings = { concurrency: CONCURRENCY, stopAfterTle: STOP_AFTER_TLE };
