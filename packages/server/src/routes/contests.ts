import { Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import type { Contest } from '@prisma/client';
import prisma from '../db';
import { gitService } from '../services/GitService';
import * as store from '../services/WorkspaceStore';
import { inWorkspace, persist } from '../collab/workspace';
import { openFile } from '../collab/persistence';
import { contestRunLimiter, contestSubmitLimiter, contestEventLimiter } from '../middleware/rateLimiter';
import { runForJudge, judgeBackend, PISTON_MAX_RUN_MS, executionBacklog } from '../services/executionService';
import {
    HttpError, handle, requireAccount, loadOwned, loadAccess, assertCanCompete, assertCanSeeProblems,
    phaseOf, contestWorkspaceId, withUniqueCode,
} from '../services/contest/access';
import { CONTEST_LANGUAGES, allowedLanguages, contestLanguage, solutionPath } from '../services/contest/languages';
import { pumpJudge, queuePosition, judgeSettings, verdictForRun, PRIORITY_INTERACTIVE } from '../services/contest/judge';
import { getLeaderboard, invalidateLeaderboard } from '../services/contest/leaderboard';
import { expandUpload, pairTests, MAX_TESTS_PER_PROBLEM, MAX_TEST_FILE_BYTES } from '../services/contest/testUpload';
import { clip } from '../services/contest/verdict';

const router = Router();

const MAX_CODE_BYTES = 64 * 1024;
const MAX_CUSTOM_INPUT_BYTES = 256 * 1024;
const MAX_SAMPLE_RUNS = 5;
const MAX_PROBLEMS = 26;
// Wandbox has no hard limit, but every test already includes compile and network time there
const MAX_TIME_LIMIT_MS = judgeBackend === 'piston' ? PISTON_MAX_RUN_MS : 10_000;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 250 } });

// ─── Helpers ────────────────────────────────────────────────────────────────

const serverNow = () => new Date().toISOString();
const normalizeNewlines = (text: string) => text.replace(/\r\n?/g, '\n');
const byteLength = (text: string) => Buffer.byteLength(text, 'utf-8');

function contestSummary(contest: Contest) {
    return {
        id: contest.id,
        code: contest.code,
        title: contest.title,
        description: contest.description,
        startsAt: contest.startsAt,
        endsAt: contest.endsAt,
        durationMinutes: contest.durationMinutes,
        phase: phaseOf(contest),
        proctoring: contest.proctoring,
        maxTabSwitches: contest.maxTabSwitches,
        leaderboard: contest.leaderboard,
        languages: allowedLanguages(contest).map(l => ({ id: l.id, label: l.label, ext: l.ext })),
        allowedLanguageIds: contest.languages,
    };
}

function intInRange(value: unknown, field: string, min: number, max: number): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `${field} must be a whole number from ${min} to ${max}`);
    return n;
}

function text(value: unknown, field: string, max: number, required = false): string {
    const s = typeof value === 'string' ? value : value == null ? '' : String(value);
    if (required && !s.trim()) throw new HttpError(400, `${field} is required`);
    if (s.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters)`);
    return s;
}

function dateValue(value: unknown, field: string): Date {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} is not a valid date`);
    return date;
}

// Settings shared by create and update
function parseSettings(body: any) {
    const data: Prisma.ContestUncheckedUpdateInput = {};
    if (body.title !== undefined) data.title = text(body.title, 'Title', 120, true).trim();
    if (body.description !== undefined) data.description = text(body.description, 'Description', 20_000);
    if (body.durationMinutes !== undefined) data.durationMinutes = intInRange(body.durationMinutes, 'Duration (minutes)', 5, 7 * 24 * 60);
    if (body.proctoring !== undefined) data.proctoring = !!body.proctoring;
    if (body.maxTabSwitches !== undefined) data.maxTabSwitches = intInRange(body.maxTabSwitches, 'Max tab switches', 1, 50);
    if (body.leaderboard !== undefined) {
        if (body.leaderboard !== 'LIVE' && body.leaderboard !== 'AFTER_END') throw new HttpError(400, 'leaderboard must be LIVE or AFTER_END');
        data.leaderboard = body.leaderboard;
    }
    if (body.languages !== undefined) {
        if (!Array.isArray(body.languages)) throw new HttpError(400, 'languages must be a list');
        const ids = CONTEST_LANGUAGES.map(l => l.id);
        data.languages = (body.languages as unknown[]).map(String).filter(id => ids.includes(id));
    }
    return data;
}

function parseProblem(body: any, partial: boolean) {
    const data: Prisma.ProblemUncheckedUpdateInput = {};
    if (body.title !== undefined || !partial) data.title = text(body.title, 'Title', 120, true).trim();
    if (body.statement !== undefined) data.statement = text(body.statement, 'Statement', 50_000);
    if (body.points !== undefined) data.points = intInRange(body.points, 'Points', 1, 10_000);
    if (body.timeLimitMs !== undefined) data.timeLimitMs = intInRange(body.timeLimitMs, 'Time limit (ms)', 250, MAX_TIME_LIMIT_MS);
    if (body.memoryLimitMb !== undefined) {
        data.memoryLimitMb = body.memoryLimitMb === null || body.memoryLimitMb === '' ? null : intInRange(body.memoryLimitMb, 'Memory limit (MB)', 16, 2048);
    }
    return data;
}

function parseTest(body: any, partial: boolean) {
    const data: { input?: string; expectedOutput?: string; isSample?: boolean } = {};
    if (body.input !== undefined || !partial) data.input = normalizeNewlines(text(body.input, 'Input', MAX_TEST_FILE_BYTES));
    if (body.expectedOutput !== undefined || !partial) {
        data.expectedOutput = normalizeNewlines(text(body.expectedOutput, 'Expected output', MAX_TEST_FILE_BYTES));
    }
    if (body.isSample !== undefined) data.isSample = !!body.isSample;
    for (const [field, value] of Object.entries(data)) {
        if (typeof value === 'string' && byteLength(value) > MAX_TEST_FILE_BYTES) throw new HttpError(400, `${field} is larger than 1 MB`);
    }
    return data;
}

async function problemOf(contest: Contest, problemId: unknown) {
    const problem = await prisma.problem.findFirst({ where: { id: String(problemId ?? ''), contestId: contest.id } });
    if (!problem) throw new HttpError(404, 'Problem not found');
    return problem;
}

// Marks a problem's tests as changed (the judge reads tests fresh for every submission)
const touchProblem = (problemId: string) => prisma.problem.update({ where: { id: problemId }, data: { updatedAt: new Date() } });

function nextProblemIndex(used: string[]): string {
    for (let i = 0; i < MAX_PROBLEMS; i++) {
        const letter = String.fromCharCode(65 + i);
        if (!used.includes(letter)) return letter;
    }
    throw new HttpError(400, `A contest can have at most ${MAX_PROBLEMS} problems`);
}

function validateSubmission(contest: Contest, body: any) {
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code.trim()) throw new HttpError(400, 'Write some code first');
    if (byteLength(code) > MAX_CODE_BYTES) throw new HttpError(400, 'Code is larger than 64 KB');
    const language = contestLanguage(String(body.language ?? ''));
    if (!language || !allowedLanguages(contest).some(l => l.id === language.id)) {
        throw new HttpError(400, 'This language is not allowed in this contest');
    }
    return { code, language };
}

const logEvent = (contestId: string, userId: string | null, type: Prisma.ContestEventCreateManyInput['type'], details?: object) =>
    prisma.contestEvent.create({ data: { contestId, userId, type, details: details as Prisma.InputJsonValue } })
        .catch(err => console.error('[Contests] Could not record event:', err));

// ─── Contests: create, list, look up ─────────────────────────────────────────

router.post('/', handle(async (req, res) => {
    const user = requireAccount(req);
    const settings = parseSettings(req.body);
    if (!settings.title) throw new HttpError(400, 'Title is required');
    const contest = await withUniqueCode(code => prisma.contest.create({
        data: {
            ...(settings as Prisma.ContestUncheckedCreateInput),
            title: settings.title as string,
            code,
            ownerId: user.id,
        },
    }));
    res.status(201).json(contestSummary(contest));
}));

router.get('/mine', handle(async (req, res) => {
    const user = requireAccount(req);
    const [owned, joined] = await Promise.all([
        prisma.contest.findMany({
            where: { ownerId: user.id },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { problems: true, participants: true } } },
        }),
        prisma.contestParticipant.findMany({
            where: { userId: user.id },
            orderBy: { joinedAt: 'desc' },
            include: { contest: { include: { owner: { select: { username: true } } } } },
        }),
    ]);
    res.json({
        owned: owned.map(c => ({ ...contestSummary(c), problemCount: c._count.problems, participantCount: c._count.participants })),
        joined: joined.map(p => ({ ...contestSummary(p.contest), organizer: p.contest.owner.username, status: p.status })),
        serverNow: serverNow(),
    });
}));

// Contest landing info by code (lobby). Works for guests too, so they're told to log in.
router.get('/resolve/:code', handle(async (req, res) => {
    const user = (req as any).user;
    const contest = await prisma.contest.findUnique({
        where: { code: String(req.params.code).trim().toUpperCase() },
        include: { owner: { select: { username: true } }, _count: { select: { problems: true, participants: true } } },
    });
    if (!contest) throw new HttpError(404, 'No contest with this code');
    const isGuest = !user?.id || String(user.id).startsWith('guest-');
    const participant = isGuest
        ? null
        : await prisma.contestParticipant.findUnique({ where: { contestId_userId: { contestId: contest.id, userId: user.id } } });
    res.json({
        contest: {
            ...contestSummary(contest),
            organizer: contest.owner.username,
            problemCount: contest._count.problems,
            participantCount: contest._count.participants,
        },
        isOwner: !isGuest && contest.ownerId === user.id,
        isGuest,
        participant: participant && {
            status: participant.status,
            tabSwitchCount: participant.tabSwitchCount,
            blockedReason: participant.blockedReason,
        },
        serverNow: serverNow(),
    });
}));

// ─── Organizer: settings, schedule, problems, tests ──────────────────────────

router.get('/:id/admin', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problems = await prisma.problem.findMany({ where: { contestId: contest.id }, orderBy: { index: 'asc' } });
    // Test metadata with short previews; full contents are fetched one test at a time
    const tests = problems.length === 0 ? [] : await prisma.$queryRaw<Array<{
        id: string; problemId: string; isSample: boolean; order: number;
        inputPreview: string; inputSize: number; outputPreview: string; outputSize: number;
    }>>`
        SELECT id, "problemId", "isSample", "order",
               left(input, 200) AS "inputPreview", octet_length(input) AS "inputSize",
               left("expectedOutput", 200) AS "outputPreview", octet_length("expectedOutput") AS "outputSize"
        FROM "TestCase"
        WHERE "problemId" IN (${Prisma.join(problems.map(p => p.id))})
        ORDER BY "order" ASC`;
    const counts = await prisma.contest.findUnique({
        where: { id: contest.id },
        select: { _count: { select: { participants: true, submissions: true } } },
    });
    res.json({
        contest: contestSummary(contest),
        problems: problems.map(p => ({
            ...p,
            tests: tests.filter(t => t.problemId === p.id).map(t => ({ ...t, inputSize: Number(t.inputSize), outputSize: Number(t.outputSize) })),
        })),
        participantCount: counts?._count.participants ?? 0,
        submissionCount: counts?._count.submissions ?? 0,
        serverNow: serverNow(),
    });
}));

router.patch('/:id', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const data = parseSettings(req.body);
    const phase = phaseOf(contest);
    // While live, a new duration moves the end time (extend or shorten)
    if (data.durationMinutes !== undefined && phase === 'LIVE' && contest.startsAt) {
        const endsAt = new Date(contest.startsAt.getTime() + (data.durationMinutes as number) * 60_000);
        if (endsAt <= new Date()) throw new HttpError(400, 'That duration would end the contest in the past. Use "End now" instead.');
        data.endsAt = endsAt;
    } else if (data.durationMinutes !== undefined && phase === 'SCHEDULED' && contest.startsAt) {
        data.endsAt = new Date(contest.startsAt.getTime() + (data.durationMinutes as number) * 60_000);
    } else if (data.durationMinutes !== undefined && phase === 'ENDED') {
        throw new HttpError(409, 'The contest has already ended');
    }
    const updated = await prisma.contest.update({ where: { id: contest.id }, data });
    if (data.leaderboard !== undefined) invalidateLeaderboard(contest.id);
    res.json(contestSummary(updated));
}));

// Start now, or schedule for a later time ({ at })
router.post('/:id/start', handle(async (req, res) => {
    const { contest, user } = await loadOwned(req, req.params.id);
    const phase = phaseOf(contest);
    if (phase === 'LIVE' || phase === 'ENDED') throw new HttpError(409, 'The contest has already started');

    const problems = await prisma.problem.findMany({ where: { contestId: contest.id }, include: { _count: { select: { tests: true } } } });
    if (problems.length === 0) throw new HttpError(400, 'Add at least one problem first');
    const untested = problems.filter(p => p._count.tests === 0).map(p => p.index);
    if (untested.length > 0) throw new HttpError(400, `Add test cases to problem ${untested.join(', ')} first`);

    const startsAt = req.body?.at ? dateValue(req.body.at, 'Start time') : new Date();
    if (req.body?.at && startsAt.getTime() < Date.now() - 60_000) throw new HttpError(400, 'Pick a start time in the future');
    const endsAt = new Date(startsAt.getTime() + contest.durationMinutes * 60_000);
    const updated = await prisma.contest.update({ where: { id: contest.id }, data: { startsAt, endsAt } });
    await logEvent(contest.id, user.id, 'START', req.body?.at ? { scheduledFor: startsAt } : undefined);
    res.json(contestSummary(updated));
}));

// Cancel a scheduled start (back to draft)
router.post('/:id/unschedule', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    if (phaseOf(contest) !== 'SCHEDULED') throw new HttpError(409, 'Only a scheduled contest can be unscheduled');
    const updated = await prisma.contest.update({ where: { id: contest.id }, data: { startsAt: null, endsAt: null } });
    res.json(contestSummary(updated));
}));

router.post('/:id/end', handle(async (req, res) => {
    const { contest, user } = await loadOwned(req, req.params.id);
    if (phaseOf(contest) !== 'LIVE') throw new HttpError(409, 'The contest is not running');
    const updated = await prisma.contest.update({ where: { id: contest.id }, data: { endsAt: new Date() } });
    await logEvent(contest.id, user.id, 'END');
    invalidateLeaderboard(contest.id);
    res.json(contestSummary(updated));
}));

router.delete('/:id', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    // Participants' code lives in workspaces "<code>__<userId>"
    await store.deleteWorkspacesWithPrefix(`${contest.code}__`);
    await prisma.contest.delete({ where: { id: contest.id } });
    invalidateLeaderboard(contest.id);
    res.json({ message: 'Contest deleted' });
}));

router.get('/:id/judge-info', handle(async (req, res) => {
    await loadOwned(req, req.params.id);
    res.json({
        backend: judgeBackend,
        concurrency: judgeSettings.concurrency,
        stopAfterTle: judgeSettings.stopAfterTle,
        maxTimeLimitMs: MAX_TIME_LIMIT_MS,
        maxTestsPerProblem: MAX_TESTS_PER_PROBLEM,
        languages: CONTEST_LANGUAGES.map(l => ({ id: l.id, label: l.label, ext: l.ext })),
    });
}));

router.post('/:id/problems', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const data = parseProblem(req.body, false);
    const used = (await prisma.problem.findMany({ where: { contestId: contest.id }, select: { index: true } })).map(p => p.index);
    const problem = await prisma.problem.create({
        data: { ...(data as Prisma.ProblemUncheckedCreateInput), title: data.title as string, contestId: contest.id, index: nextProblemIndex(used) },
    });
    res.status(201).json({ ...problem, tests: [] });
}));

router.patch('/:id/problems/:pid', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const data = parseProblem(req.body, true);
    const updated = await prisma.problem.update({ where: { id: problem.id }, data });
    // Points changed: rescale existing scores (each test stays worth an equal share)
    if (data.points !== undefined && data.points !== problem.points) {
        await prisma.$executeRaw`
            UPDATE "Submission"
            SET score = ROUND((${updated.points}::float8 * passed / NULLIF(total, 0))::numeric, 2)::float8
            WHERE "problemId" = ${problem.id} AND status = 'DONE'`;
        invalidateLeaderboard(contest.id);
    }
    res.json(updated);
}));

router.delete('/:id/problems/:pid', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    // Problem letters name the participants' files and appear in standings
    const phase = phaseOf(contest);
    if (phase === 'LIVE' || phase === 'ENDED') throw new HttpError(409, 'Problems can\'t be deleted once the contest has started');
    await prisma.problem.delete({ where: { id: problem.id } });
    res.json({ message: 'Problem deleted' });
}));

// Judge every finished submission of a problem again (after fixing its tests)
router.post('/:id/problems/:pid/rejudge', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const { count } = await prisma.submission.updateMany({
        where: { problemId: problem.id, status: { in: ['DONE', 'ERROR'] } },
        data: { status: 'QUEUED', results: [], passed: 0, score: 0, verdict: null, startedAt: null, finishedAt: null, compileOutput: null },
    });
    invalidateLeaderboard(contest.id);
    pumpJudge();
    res.json({ requeued: count });
}));

router.get('/:id/problems/:pid/tests/:tid', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const test = await prisma.testCase.findFirst({ where: { id: req.params.tid, problemId: problem.id } });
    if (!test) throw new HttpError(404, 'Test not found');
    res.json(test);
}));

router.post('/:id/problems/:pid/tests', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const data = parseTest(req.body, false);
    const existing = await prisma.testCase.aggregate({ where: { problemId: problem.id }, _count: true, _max: { order: true } });
    if (existing._count >= MAX_TESTS_PER_PROBLEM) throw new HttpError(400, `At most ${MAX_TESTS_PER_PROBLEM} tests per problem`);
    const test = await prisma.testCase.create({
        data: {
            problemId: problem.id,
            input: data.input ?? '',
            expectedOutput: data.expectedOutput ?? '',
            isSample: data.isSample ?? false,
            order: (existing._max.order ?? 0) + 1,
        },
    });
    await touchProblem(problem.id);
    res.status(201).json(test);
}));

router.patch('/:id/problems/:pid/tests/:tid', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const test = await prisma.testCase.findFirst({ where: { id: req.params.tid, problemId: problem.id } });
    if (!test) throw new HttpError(404, 'Test not found');
    const updated = await prisma.testCase.update({ where: { id: test.id }, data: parseTest(req.body, true) });
    await touchProblem(problem.id);
    res.json(updated);
}));

router.delete('/:id/problems/:pid/tests/:tid', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const { count } = await prisma.testCase.deleteMany({ where: { id: req.params.tid, problemId: problem.id } });
    if (count === 0) throw new HttpError(404, 'Test not found');
    await touchProblem(problem.id);
    res.json({ message: 'Test deleted' });
}));

// Bulk upload: a zip or loose files (1.in/1.out, input/1.txt + output/1.txt, ...).
// Fields: mode = append | replace, sampleCount = mark the first N tests as samples (optional).
router.post('/:id/problems/:pid/tests/upload', upload.any(), handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const problem = await problemOf(contest, req.params.pid);
    const files = ((req as any).files || []) as Array<{ originalname: string; buffer: Buffer }>;
    // Folder uploads send each file's relative path in `paths[]`, in the same order
    const rawPaths = req.body.paths;
    const paths: string[] = Array.isArray(rawPaths) ? rawPaths : rawPaths ? [rawPaths] : [];
    const parsed = pairTests(expandUpload(files.map((f, i) => ({ name: paths[i] || f.originalname, data: f.buffer }))));

    const replace = req.body.mode === 'replace';
    const sampleCount = req.body.sampleCount !== undefined && req.body.sampleCount !== ''
        ? intInRange(req.body.sampleCount, 'Sample count', 0, parsed.length)
        : null;
    const existing = await prisma.testCase.aggregate({ where: { problemId: problem.id }, _count: true, _max: { order: true } });
    if ((replace ? 0 : existing._count) + parsed.length > MAX_TESTS_PER_PROBLEM) {
        throw new HttpError(400, `At most ${MAX_TESTS_PER_PROBLEM} tests per problem`);
    }

    const start = replace ? 0 : existing._max.order ?? 0;
    await prisma.$transaction([
        ...(replace ? [prisma.testCase.deleteMany({ where: { problemId: problem.id } })] : []),
        prisma.testCase.createMany({
            data: parsed.map((t, i) => ({
                problemId: problem.id,
                input: normalizeNewlines(t.input),
                expectedOutput: normalizeNewlines(t.expectedOutput),
                isSample: sampleCount !== null ? i < sampleCount : t.isSample,
                order: start + i + 1,
            })),
        }),
    ]);
    await touchProblem(problem.id);
    res.status(201).json({ added: parsed.length, samples: parsed.filter((t, i) => (sampleCount !== null ? i < sampleCount : t.isSample)).length, names: parsed.map(t => t.name) });
}));

// ─── Participants: join, problems, code, run, submit ─────────────────────────

router.post('/:id/join', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    if (access.isOwner) return res.json({ isOwner: true });
    if (access.participant) {
        if (access.participant.status === 'REMOVED') throw new HttpError(403, 'You have been removed from this contest');
        return res.json({ status: access.participant.status });
    }
    if (access.phase === 'ENDED') throw new HttpError(403, 'The contest has ended');
    const participant = await prisma.contestParticipant.create({ data: { contestId: access.contest.id, userId: access.user.id } });
    await logEvent(access.contest.id, access.user.id, 'JOIN');
    invalidateLeaderboard(access.contest.id);
    res.status(201).json({ status: participant.status });
}));

// Problems with their sample tests only; hidden tests never leave the server
router.get('/:id/problems', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    assertCanSeeProblems(access);
    const problems = await prisma.problem.findMany({
        where: { contestId: access.contest.id },
        orderBy: { index: 'asc' },
        include: {
            tests: { where: { isSample: true }, orderBy: { order: 'asc' }, select: { input: true, expectedOutput: true } },
            _count: { select: { tests: true } },
        },
    });
    res.json({
        problems: problems.map(p => ({
            id: p.id,
            index: p.index,
            title: p.title,
            statement: p.statement,
            points: p.points,
            timeLimitMs: p.timeLimitMs,
            memoryLimitMb: p.memoryLimitMb,
            samples: p.tests,
            testCount: p._count.tests,
        })),
        judge: { backend: judgeBackend },
        serverNow: serverNow(),
    });
}));

// Loads the caller's file for a problem into their live editor doc, creating it from the language
// template the first time. After the contest ends, existing files can still be opened (read-only).
router.post('/:id/open', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    const problem = await problemOf(access.contest, req.body?.problemId);
    const language = contestLanguage(String(req.body?.language ?? ''));
    if (!language || !allowedLanguages(access.contest).some(l => l.id === language.id)) {
        throw new HttpError(400, 'This language is not allowed in this contest');
    }
    let canCreate = true;
    if (!access.isOwner) {
        if (access.phase === 'ENDED' && access.participant && access.participant.status !== 'REMOVED') canCreate = false;
        else assertCanCompete(access);
    }

    const workspaceId = contestWorkspaceId(access.contest, access.user.id);
    const filePath = solutionPath(problem.index, language);
    const result = await inWorkspace(workspaceId, async () => {
        const abs = gitService.resolveFilePath(workspaceId, filePath);
        if (!fs.existsSync(abs)) {
            if (!canCreate) throw new HttpError(404, 'No code was written for this problem in this language');
            gitService.writeFile(workspaceId, filePath, language.template);
            await persist(workspaceId, () => store.upsertFile(workspaceId, filePath, Buffer.from(language.template, 'utf-8')));
        }
        return openFile(workspaceId, filePath);
    });
    if (!result.ok) throw new HttpError(result.status, result.error);
    res.json({ path: filePath, readOnly: !canCreate });
}));

// Run against the sample tests, or with custom input. Not stored and not scored.
router.post('/:id/run', contestRunLimiter, handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    assertCanCompete(access);
    const problem = await problemOf(access.contest, req.body?.problemId);
    const { code, language } = validateSubmission(access.contest, req.body);
    const limits = { timeLimitMs: problem.timeLimitMs, memoryLimitMb: problem.memoryLimitMb, priority: PRIORITY_INTERACTIVE };

    if (req.body?.mode === 'custom') {
        const stdin = normalizeNewlines(typeof req.body.stdin === 'string' ? req.body.stdin : '');
        if (byteLength(stdin) > MAX_CUSTOM_INPUT_BYTES) throw new HttpError(400, 'Custom input is larger than 256 KB');
        const run = await runForJudge({ code, language: language.id, stdin, ...limits });
        return res.json({
            mode: 'custom',
            kind: run.kind,
            stdout: clip(run.stdout),
            stderr: clip(run.stderr),
            compileOutput: clip(run.compileOutput),
            timeMs: run.timeMs,
            timeExact: run.timeExact,
            message: run.message,
        });
    }

    const samples = await prisma.testCase.findMany({
        where: { problemId: problem.id, isSample: true },
        orderBy: { order: 'asc' },
        take: MAX_SAMPLE_RUNS,
    });
    if (samples.length === 0) throw new HttpError(400, 'This problem has no sample tests. Use custom input instead.');
    const results = [];
    let compileOutput: string | null = null;
    for (const sample of samples) {
        const run = await runForJudge({ code, language: language.id, stdin: sample.input, ...limits });
        const verdict = verdictForRun(run, sample.expectedOutput);
        results.push({
            verdict,
            stdout: clip(run.stdout),
            stderr: clip(run.stderr),
            timeMs: run.timeMs,
            timeExact: run.timeExact,
            input: clip(sample.input),
            expected: clip(sample.expectedOutput),
            message: run.message,
        });
        if (verdict === 'CE') {
            compileOutput = clip(run.compileOutput);
            break;
        }
        if (verdict === 'TLE' || verdict === 'IE') break;
    }
    res.json({ mode: 'samples', results, compileOutput, totalSamples: samples.length });
}));

router.post('/:id/submit', contestSubmitLimiter, handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    assertCanCompete(access);
    const problem = await problemOf(access.contest, req.body?.problemId);
    const { code, language } = validateSubmission(access.contest, req.body);
    const testCount = await prisma.testCase.count({ where: { problemId: problem.id } });
    if (testCount === 0) throw new HttpError(400, 'This problem has no test cases yet');

    // One submission at a time per person keeps the shared judge fair
    const inFlight = await prisma.submission.count({
        where: { contestId: access.contest.id, userId: access.user.id, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (inFlight > 0) throw new HttpError(429, 'Your previous submission is still being judged');

    const submission = await prisma.submission.create({
        data: {
            contestId: access.contest.id,
            problemId: problem.id,
            userId: access.user.id,
            language: language.id,
            code,
            total: testCount,
        },
    });
    pumpJudge();
    res.status(201).json({ id: submission.id, status: submission.status, createdAt: submission.createdAt });
}));

// The caller's own submissions (newest first)
router.get('/:id/submissions', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    if (!access.isOwner && !access.participant) throw new HttpError(403, 'Join the contest first');
    const submissions = await prisma.submission.findMany({
        where: {
            contestId: access.contest.id,
            userId: access.user.id,
            ...(req.query.problem ? { problemId: String(req.query.problem) } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true, problemId: true, language: true, status: true, verdict: true,
            passed: true, total: true, score: true, createdAt: true, finishedAt: true,
        },
    });
    res.json({ submissions, serverNow: serverNow() });
}));

router.get('/:id/submissions/:sid', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    const submission = await prisma.submission.findFirst({
        where: { id: req.params.sid, contestId: access.contest.id },
        include: { user: { select: { username: true } }, problem: { select: { index: true, title: true } } },
    });
    if (!submission || (!access.isOwner && submission.userId !== access.user.id)) throw new HttpError(404, 'Submission not found');
    res.json({
        ...submission,
        queuePosition: await queuePosition(submission),
        serverNow: serverNow(),
    });
}));

router.post('/:id/submissions/:sid/rejudge', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const { count } = await prisma.submission.updateMany({
        where: { id: req.params.sid, contestId: contest.id, status: { in: ['DONE', 'ERROR'] } },
        data: { status: 'QUEUED', results: [], passed: 0, score: 0, verdict: null, startedAt: null, finishedAt: null, compileOutput: null },
    });
    if (count === 0) throw new HttpError(409, 'Only a finished submission can be rejudged');
    invalidateLeaderboard(contest.id);
    pumpJudge();
    res.json({ requeued: count });
}));

router.get('/:id/leaderboard', handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    if (!access.isOwner && !access.participant) throw new HttpError(403, 'Join the contest first');
    const problems = await prisma.problem.findMany({
        where: { contestId: access.contest.id },
        orderBy: { index: 'asc' },
        select: { id: true, index: true, title: true, points: true },
    });
    const hidden = !access.isOwner && access.contest.leaderboard === 'AFTER_END' && access.phase !== 'ENDED';
    if (hidden) return res.json({ hidden: true, problems, rows: [], serverNow: serverNow() });
    res.json({ hidden: false, problems, rows: await getLeaderboard(access.contest), serverNow: serverNow() });
}));

// Proctoring events from the participant's browser (only when the contest has proctoring on)
router.post('/:id/proctor', contestEventLimiter, handle(async (req, res) => {
    const access = await loadAccess(req, req.params.id);
    const participant = access.participant;
    if (!participant || access.phase !== 'LIVE' || !access.contest.proctoring) return res.json({ blocked: false, ignored: true });

    const type = String(req.body?.type ?? '');
    if (type === 'TAB_SWITCH') {
        const tabSwitchCount = participant.tabSwitchCount + 1;
        const block = participant.status === 'ACTIVE' && tabSwitchCount >= access.contest.maxTabSwitches;
        const reason = 'Blocked automatically: too many tab switches';
        const updated = await prisma.contestParticipant.update({
            where: { id: participant.id },
            data: { tabSwitchCount, ...(block ? { status: 'BLOCKED', blockedReason: reason } : {}) },
        });
        await logEvent(access.contest.id, access.user.id, 'TAB_SWITCH', { count: tabSwitchCount });
        if (block) await logEvent(access.contest.id, access.user.id, 'BLOCK', { reason, automatic: true });
        return res.json({
            blocked: updated.status === 'BLOCKED',
            reason: updated.blockedReason,
            tabSwitchCount,
            maxTabSwitches: access.contest.maxTabSwitches,
        });
    }
    if (type === 'FULLSCREEN_EXIT' || type === 'PASTE') {
        await logEvent(access.contest.id, access.user.id, type, type === 'PASTE' ? { length: Number(req.body?.length) || 0 } : undefined);
        return res.json({ blocked: participant.status === 'BLOCKED' });
    }
    throw new HttpError(400, 'Unknown event type');
}));

// ─── Organizer: live monitor ─────────────────────────────────────────────────

router.get('/:id/monitor', handle(async (req, res) => {
    const { contest } = await loadOwned(req, req.params.id);
    const [problems, participants, events, submissions, queued] = await Promise.all([
        prisma.problem.findMany({ where: { contestId: contest.id }, orderBy: { index: 'asc' }, select: { id: true, index: true, title: true, points: true } }),
        prisma.contestParticipant.findMany({
            where: { contestId: contest.id },
            orderBy: { joinedAt: 'asc' },
            include: { user: { select: { username: true } } },
        }),
        prisma.contestEvent.findMany({
            where: { contestId: contest.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { user: { select: { username: true } } },
        }),
        prisma.submission.findMany({
            where: { contestId: contest.id },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true, userId: true, problemId: true, language: true, status: true, verdict: true,
                passed: true, total: true, score: true, createdAt: true, user: { select: { username: true } },
            },
        }),
        prisma.submission.count({ where: { contestId: contest.id, status: 'QUEUED' } }),
    ]);
    res.json({
        contest: contestSummary(contest),
        problems,
        participants: participants.map(p => ({
            userId: p.userId,
            username: p.user.username,
            status: p.status,
            tabSwitchCount: p.tabSwitchCount,
            blockedReason: p.blockedReason,
            joinedAt: p.joinedAt,
        })),
        leaderboard: await getLeaderboard(contest),
        events: events.map(e => ({ id: e.id, type: e.type, userId: e.userId, username: e.user?.username ?? null, details: e.details, createdAt: e.createdAt })),
        submissions: submissions.map(s => ({ ...s, username: s.user.username, user: undefined })),
        judge: { backend: judgeBackend, queued, backlog: executionBacklog() },
        serverNow: serverNow(),
    });
}));

router.post('/:id/participants/:uid/:action', handle(async (req, res) => {
    const { contest, user } = await loadOwned(req, req.params.id);
    const participant = await prisma.contestParticipant.findUnique({
        where: { contestId_userId: { contestId: contest.id, userId: req.params.uid } },
    });
    if (!participant) throw new HttpError(404, 'Participant not found');

    const action = req.params.action;
    let data: Prisma.ContestParticipantUpdateInput;
    if (action === 'block') {
        data = { status: 'BLOCKED', blockedReason: text(req.body?.reason, 'Reason', 300) || 'Blocked by the organizer' };
    } else if (action === 'unblock') {
        data = { status: 'ACTIVE', blockedReason: null, tabSwitchCount: 0 };
    } else if (action === 'remove') {
        data = { status: 'REMOVED', blockedReason: 'Removed by the organizer' };
    } else {
        throw new HttpError(400, 'Unknown action');
    }
    const updated = await prisma.contestParticipant.update({ where: { id: participant.id }, data });
    await logEvent(contest.id, participant.userId, action.toUpperCase() as 'BLOCK' | 'UNBLOCK' | 'REMOVE', { by: user.username });
    invalidateLeaderboard(contest.id);
    res.json({ status: updated.status });
}));

export default router;
