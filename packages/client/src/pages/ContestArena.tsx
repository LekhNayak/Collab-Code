import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type * as Y from 'yjs';
import {
    ArrowLeft, Ban, CheckCircle2, Clock, Copy, Loader2, LogIn, Play, Send, Trophy, X, Lock, FlaskConical, ListChecks, Database,
} from 'lucide-react';
import CodeEditor from '../components/Editor';
import ThemeToggle from '../components/ThemeToggle';
import Markdown from '../components/contest/Markdown';
import Countdown from '../components/contest/Countdown';
import Leaderboard from '../components/contest/Leaderboard';
import VerdictBadge from '../components/contest/VerdictBadge';
import ResultTable from '../components/contest/ResultTable';
import ProctoringOverlay from '../components/ProctoringOverlay';
import { useCollabWorkspace, openCollabFile } from '../collab/useCollabWorkspace';
import { useProctoring } from '../hooks/useProctoring';
import { getTokenUser } from '../auth';
import { recordRecent } from '../recent';
import Overlay from '../components/ui/Overlay';
import { languageLabel, monacoLanguageFor, solutionPath, SQL_LANGUAGE, type ContestLanguageInfo } from '../contest/languages';
import {
    contestApi, errorMessage, formatScore, PHASE_LABEL, PHASE_STYLE, VERDICT_STYLE,
    type LeaderboardProblem, type LeaderboardRow, type ParticipantProblem, type ResolveResponse, type RunResponse,
    type SqlTable, type SubmissionDetail, type SubmissionSummary,
} from '../contestApi';

const panelButton = 'h-8 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40';

export default function ContestArena() {
    const { code = '' } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [info, setInfo] = useState<ResolveResponse | null>(null);
    const [error, setError] = useState('');
    const [clockOffset, setClockOffset] = useState(0);
    const [joining, setJoining] = useState(false);

    const load = useCallback(async () => {
        try {
            const next = await contestApi.resolve(code);
            setInfo(next);
            setClockOffset(new Date(next.serverNow).getTime() - Date.now());
            setError('');
        } catch (err) {
            setError(errorMessage(err));
        }
    }, [code]);

    // Contest state (phase, end time, our status) refreshes every 15 seconds
    useEffect(() => {
        load();
        const timer = setInterval(load, 15_000);
        return () => clearInterval(timer);
    }, [load]);

    // Reload right when the contest starts or ends; the small random delay spreads out the load
    useEffect(() => {
        if (!info) return;
        const { phase, startsAt, endsAt } = info.contest;
        const target = phase === 'SCHEDULED' ? startsAt : phase === 'LIVE' ? endsAt : null;
        if (!target) return;
        const wait = new Date(target).getTime() - new Date(info.serverNow).getTime() + Math.random() * 1500;
        const timer = setTimeout(load, Math.max(250, wait));
        return () => clearTimeout(timer);
    }, [info, load]);

    // Remember this contest for the Hub's "Jump back in" list
    const recentCode = info && !info.isGuest ? info.contest.code : null;
    const recentTitle = info?.contest.title;
    useEffect(() => {
        if (recentCode) recordRecent({ kind: 'contest', id: recentCode, title: recentTitle || recentCode });
    }, [recentCode, recentTitle]);

    const join = async () => {
        if (!info) return;
        setJoining(true);
        try {
            await contestApi.join(info.contest.id);
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setJoining(false);
        }
    };

    if (!info) {
        return (
            <Screen>
                {error ? (
                    <div className="text-center">
                        <div className="text-danger-text text-lg mb-6">{error}</div>
                        <button onClick={() => navigate('/contests')} className={`${panelButton} mx-auto bg-tint-2 hover:bg-tint-3`}><ArrowLeft size={16} /> Contests</button>
                    </div>
                ) : <Loader2 className="animate-spin text-fg-3" size={32} />}
            </Screen>
        );
    }

    const { contest, participant, isOwner, isGuest } = info;
    const status = participant?.status;

    if (isGuest) {
        return (
            <Lobby info={info} offsetMs={clockOffset} onBack={() => navigate('/contests')}>
                <div className="rounded-lg  bg-accent/10 px-4 py-3 text-accent-text text-sm">
                    Contests need an account so your submissions and score can be saved. Log out and register or sign in, then open this contest again.
                </div>
            </Lobby>
        );
    }

    if (status === 'BLOCKED' || status === 'REMOVED') {
        return (
            <Screen>
                <div className="ui-card max-w-md w-full p-10 text-center">
                    <Ban size={44} className="mx-auto text-danger-text mb-5" />
                    <h1 className="text-xl font-semibold text-danger-text mb-2">{status === 'BLOCKED' ? 'You have been blocked' : 'You have been removed'}</h1>
                    <p className="text-fg-2 mb-8">{participant?.blockedReason || 'Contact the organizer if you think this is a mistake.'}</p>
                    <button onClick={() => navigate('/contests')} className={`${panelButton} mx-auto bg-tint-2 hover:bg-tint-3`}><ArrowLeft size={16} /> Contests</button>
                </div>
            </Screen>
        );
    }

    const started = contest.phase === 'LIVE' || contest.phase === 'ENDED';
    if (!isOwner && (!participant || !started)) {
        return (
            <Lobby info={info} offsetMs={clockOffset} onBack={() => navigate('/contests')}>
                {error && <div className="rounded-lg  bg-danger/10 px-4 py-3 text-danger-text text-sm">{error}</div>}
                {participant ? (
                    <div className="flex items-center justify-center gap-2 text-success-text font-semibold">
                        <CheckCircle2 size={20} /> You're registered. {contest.phase === 'DRAFT' ? 'Waiting for the organizer to start the contest.' : 'Problems unlock when the countdown ends.'}
                    </div>
                ) : contest.phase === 'ENDED' ? (
                    <div className="text-center text-fg-3">This contest has ended.</div>
                ) : (
                    <button onClick={join} disabled={joining} className="h-11 w-full rounded-lg bg-accent-solid hover:bg-accent text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                        <LogIn size={18} /> {joining ? 'Joining…' : 'Join contest'}
                    </button>
                )}
            </Lobby>
        );
    }

    return <Arena info={info} offsetMs={clockOffset} onReload={load} />;
}

function Screen({ children }: { children: React.ReactNode }) {
    return <main id="main-content" tabIndex={-1} className="h-[100dvh] w-full bg-canvas text-fg flex items-center justify-center p-6 focus:outline-none">{children}</main>;
}

function Lobby({ info, offsetMs, onBack, children }: { info: ResolveResponse; offsetMs: number; onBack: () => void; children: React.ReactNode }) {
    const { contest } = info;
    return (
        <div className="h-[100dvh] w-full bg-canvas text-fg overflow-y-auto">
            <main id="main-content" tabIndex={-1} className="max-w-2xl mx-auto px-6 py-10 focus:outline-none">
                <button onClick={onBack} className="mb-8 flex items-center gap-2 text-fg-3 hover:text-fg text-sm"><ArrowLeft size={16} /> Contests</button>
                <div className="ui-card p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text"><Trophy size={24} /></div>
                        <div>
                            <h1 className="text-2xl font-semibold leading-tight tracking-tight">{contest.title}</h1>
                            <div className="text-fg-3 text-sm">by {contest.organizer} · <span className="font-mono">{contest.code}</span></div>
                        </div>
                    </div>

                    <div className="rounded-xl bg-canvas border border-line p-6 text-center mb-6">
                        <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium mb-3 ${PHASE_STYLE[contest.phase]}`}>{PHASE_LABEL[contest.phase]}</span>
                        {contest.phase === 'SCHEDULED' && (
                            <>
                                <div className="text-fg-3 text-sm mb-1">Starts in</div>
                                <Countdown target={contest.startsAt} offsetMs={offsetMs} className="text-5xl font-semibold text-accent-text" />
                                <div className="text-fg-3 text-sm mt-2">{new Date(contest.startsAt!).toLocaleString()}</div>
                            </>
                        )}
                        {contest.phase === 'DRAFT' && <div className="text-fg-2">Not scheduled yet</div>}
                        {contest.phase === 'LIVE' && (
                            <><div className="text-fg-3 text-sm mb-1">Running · ends in</div><Countdown target={contest.endsAt} offsetMs={offsetMs} className="text-4xl font-semibold text-success-text" /></>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-6">
                        <Fact label="Problems" value={String(contest.problemCount)} />
                        <Fact label="Duration" value={`${contest.durationMinutes} min`} />
                        <Fact label="Participants" value={String(contest.participantCount)} />
                        <Fact label="Leaderboard" value={contest.leaderboard === 'LIVE' ? 'Live' : 'After the end'} />
                        <div className="col-span-2"><Fact label="Languages" value={contest.languages.map(l => l.label).join(', ')} /></div>
                    </div>

                    {contest.proctoring && (
                        <div className="rounded-lg  bg-danger/10 px-4 py-3 text-sm text-danger-text/90 mb-6 flex gap-2.5">
                            <Lock size={16} className="shrink-0 mt-0.5 text-danger-text" />
                            Proctored: the contest runs in fullscreen, and tab switches are recorded. You'll be blocked after {contest.maxTabSwitches} tab switches.
                        </div>
                    )}

                    {contest.description && <div className="mb-6"><Markdown>{contest.description}</Markdown></div>}

                    <div className="space-y-3">{children}</div>
                </div>
                <p className="text-center text-fg-3 text-xs mt-6">
                    Each problem's points are split evenly across its test cases. Your best submission per problem counts; ties go to whoever reached their score first.
                </p>
            </main>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-canvas border border-line-faint px-3.5 py-2.5">
            <div className="text-fg-3 text-xs ">{label}</div>
            <div className="font-semibold mt-0.5">{value}</div>
        </div>
    );
}

// ─── Arena: problems, editor, results ─────────────────────────────────────────

type Panel = 'result' | 'custom' | 'submissions';

const languageKey = (code: string, problemIndex: string) => `contest:${code}:lang:${problemIndex}`;

function storedLanguage(code: string, problemIndex: string): string | null {
    try {
        return localStorage.getItem(languageKey(code, problemIndex));
    } catch {
        return null;
    }
}

function Arena({ info, offsetMs, onReload }: { info: ResolveResponse; offsetMs: number; onReload: () => Promise<void> }) {
    const navigate = useNavigate();
    const { contest, isOwner, participant } = info;
    const user = getTokenUser();
    const readOnly = !isOwner && contest.phase === 'ENDED';

    const [problems, setProblems] = useState<ParticipantProblem[]>([]);
    const [problemId, setProblemId] = useState<string | null>(null);
    const [languages, setLanguages] = useState<Record<string, string>>({});
    const [openErrors, setOpenErrors] = useState<Record<string, string>>({});
    const [filesVersion, setFilesVersion] = useState(0);
    const [panel, setPanel] = useState<Panel>('result');
    const [panelError, setPanelError] = useState('');
    const [running, setRunning] = useState(false);
    const [runResult, setRunResult] = useState<RunResponse | null>(null);
    const [customInput, setCustomInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);
    const [activeSubmission, setActiveSubmission] = useState<SubmissionDetail | null>(null);
    const [mySubmissions, setMySubmissions] = useState<SubmissionSummary[]>([]);
    const [showBoard, setShowBoard] = useState(false);
    const [board, setBoard] = useState<{ hidden: boolean; rows: LeaderboardRow[]; problems: LeaderboardProblem[] } | null>(null);

    const collab = useCollabWorkspace(contest.code, { name: user?.username ?? 'Anonymous', id: user?.id ?? null });
    const workspaceId = `${contest.code}__${user?.id ?? ''}`;

    useEffect(() => {
        contestApi.problems(contest.id)
            .then(data => {
                setProblems(data.problems);
                setProblemId(current => current ?? data.problems[0]?.id ?? null);
            })
            .catch(err => setPanelError(errorMessage(err)));
    }, [contest.id]);

    const refreshSubmissions = useCallback(() => {
        contestApi.submissions(contest.id).then(data => setMySubmissions(data.submissions)).catch(() => {});
    }, [contest.id]);
    useEffect(refreshSubmissions, [refreshSubmissions]);

    const problem = problems.find(p => p.id === problemId) ?? null;
    const languageId = problem
        ? languages[problem.id] ?? storedLanguage(contest.code, problem.index) ?? (contest.languages.some(l => l.id === 'python') ? 'python' : contest.languages[0]?.id)
        : null;
    const isSql = problem?.kind === 'SQL';
    const language: ContestLanguageInfo | null = isSql
        ? SQL_LANGUAGE
        : contest.languages.find(l => l.id === languageId) ?? contest.languages[0] ?? null;
    const path = problem && language ? solutionPath(problem.index, language) : '';

    const chooseLanguage = (id: string) => {
        if (!problem) return;
        setLanguages(prev => ({ ...prev, [problem.id]: id }));
        try {
            localStorage.setItem(languageKey(contest.code, problem.index), id);
        } catch {
            // the choice just won't be remembered
        }
    };

    // Re-render when files arrive in the shared doc
    useEffect(() => {
        if (!collab) return;
        const onChange = () => setFilesVersion(v => v + 1);
        collab.files.observe(onChange);
        return () => collab.files.unobserve(onChange);
    }, [collab]);

    // Load the current problem's file (created from the language template the first time)
    useEffect(() => {
        if (!collab || !problem || !language || !path) return;
        if (collab.files.has(path) || openErrors[path]) return;
        openCollabFile(collab, workspaceId, path, () => contestApi.open(contest.id, problem.id, language.id))
            .catch(err => setOpenErrors(prev => ({ ...prev, [path]: errorMessage(err) })));
    }, [collab, problem, language, path, workspaceId, contest.id, openErrors, filesVersion]);

    const ytext: Y.Text | null = (path && collab?.files.get(path)) || null;
    const [openedPaths, setOpenedPaths] = useState<string[]>([]);
    if (ytext && path && !openedPaths.includes(path)) setOpenedPaths([...openedPaths, path]);

    // Poll the submission being judged until it finishes
    useEffect(() => {
        if (!activeSubmissionId) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const poll = async () => {
            try {
                const submission = await contestApi.submission(contest.id, activeSubmissionId);
                if (stopped) return;
                setActiveSubmission(submission);
                if (submission.status === 'QUEUED' || submission.status === 'RUNNING') {
                    timer = setTimeout(poll, 1000);
                } else {
                    refreshSubmissions();
                }
            } catch {
                if (!stopped) timer = setTimeout(poll, 3000);
            }
        };
        poll();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [activeSubmissionId, contest.id, refreshSubmissions]);

    // Leaderboard drawer: refresh while open
    useEffect(() => {
        if (!showBoard) return;
        const fetchBoard = () => contestApi.leaderboard(contest.id).then(setBoard).catch(() => {});
        fetchBoard();
        const timer = setInterval(fetchBoard, 15_000);
        return () => clearInterval(timer);
    }, [showBoard, contest.id]);

    // Proctoring (organizer-enabled), only for participants while the contest is live
    const proctoring = useProctoring({
        enabled: contest.proctoring && !isOwner && !!participant && contest.phase === 'LIVE',
        sessionKey: contest.id,
        adapter: {
            tabSwitch: async () => {
                const r = await contestApi.proctor(contest.id, 'TAB_SWITCH');
                return r.ignored ? null : { blocked: r.blocked, count: r.tabSwitchCount, reason: r.reason };
            },
            fullscreenExit: () => contestApi.proctor(contest.id, 'FULLSCREEN_EXIT'),
            clipboard: (kind, length) => (kind === 'paste' ? contestApi.proctor(contest.id, 'PASTE', length) : Promise.resolve()),
            status: async () => ({ blocked: participant?.status === 'BLOCKED', reason: participant?.blockedReason }),
        },
        onBlocked: () => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            onReload();
        },
    });

    // Best score per problem (finished submissions), and the total
    const best = useMemo(() => {
        const map: Record<string, number> = {};
        for (const s of mySubmissions) {
            if (s.status === 'DONE') map[s.problemId] = Math.max(map[s.problemId] ?? 0, s.score);
        }
        return map;
    }, [mySubmissions]);
    const totalScore = Object.values(best).reduce((a, b) => a + b, 0);
    const maxScore = problems.reduce((a, p) => a + p.points, 0);
    const judging = activeSubmission && (activeSubmission.status === 'QUEUED' || activeSubmission.status === 'RUNNING');

    const currentCode = () => ytext?.toString() ?? '';

    const runSamples = async () => {
        if (!problem || !language) return;
        setPanel('result');
        setRunning(true);
        setPanelError('');
        setActiveSubmissionId(null);
        setActiveSubmission(null);
        try {
            setRunResult(await contestApi.runSamples(contest.id, problem.id, language.id, currentCode()));
        } catch (err) {
            setPanelError(errorMessage(err));
        } finally {
            setRunning(false);
        }
    };

    const runCustom = async () => {
        if (!problem || !language) return;
        setRunning(true);
        setPanelError('');
        try {
            setRunResult(await contestApi.runCustom(contest.id, problem.id, language.id, currentCode(), customInput));
        } catch (err) {
            setPanelError(errorMessage(err));
        } finally {
            setRunning(false);
        }
    };

    const submit = async () => {
        if (!problem || !language) return;
        setPanel('result');
        setSubmitting(true);
        setPanelError('');
        setRunResult(null);
        try {
            const { id } = await contestApi.submit(contest.id, problem.id, language.id, currentCode());
            setActiveSubmission(null);
            setActiveSubmissionId(id);
        } catch (err) {
            setPanelError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const openError = path ? openErrors[path] : undefined;
    const problemSubmissions = mySubmissions.filter(s => s.problemId === problem?.id);

    return (
        <div className="h-[100dvh] w-full bg-canvas text-fg flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 shrink-0 border-b border-line flex items-center gap-4 px-4">
                <button onClick={() => navigate('/contests')} className="p-2 rounded-lg hover:bg-tint-3 text-fg-2" title="Leave" aria-label="Leave the contest"><ArrowLeft size={18} /></button>
                <Trophy size={18} className="text-accent-text shrink-0" />
                <div className="font-semibold truncate">{contest.title}</div>
                {isOwner && <span className="inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium  bg-accent/10 text-accent-text gap-1 shrink-0"><FlaskConical size={12} /> Organizer test mode: not ranked</span>}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-fg-3" />
                    {contest.phase === 'LIVE' ? <Countdown target={contest.endsAt} offsetMs={offsetMs} className="font-semibold text-success-text" /> : <span className="text-fg-3">{PHASE_LABEL[contest.phase]}</span>}
                </div>
                <div className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-tint-2 tabular-nums">
                    {formatScore(totalScore)} <span className="text-fg-2">/ {maxScore}</span>
                </div>
                <ThemeToggle />
                <button onClick={() => setShowBoard(true)} className={`${panelButton} bg-accent/15  text-accent-text hover:bg-accent/25`}>
                    <ListChecks size={16} /> Leaderboard
                </button>
            </header>

            <div id="main-content" role="main" tabIndex={-1} className="flex-1 min-h-0 flex flex-col focus:outline-none lg:flex-row">
                {/* Problem */}
                <section className="lg:w-[42%] min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-line">
                    <div className="flex gap-1 px-3 pt-3 overflow-x-auto shrink-0">
                        {problems.map(p => {
                            const score = best[p.id];
                            const solved = score !== undefined && score >= p.points;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setProblemId(p.id)}
                                    className={`px-3.5 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors ${p.id === problemId ? 'bg-tint-2 border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`}
                                >
                                    {p.index}
                                    {score !== undefined && <span className={`ml-1.5 text-xs ${solved ? 'text-success-text' : 'text-accent-text'}`}>{formatScore(score)}</span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-tint-1">
                        {!problem ? (
                            <div className="text-fg-3">{panelError || 'Loading problems…'}</div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-semibold mb-2">{problem.index}. {problem.title}</h1>
                                <div className="flex flex-wrap gap-2 text-xs mb-5">
                                    <span className="px-2 py-1 rounded-md bg-accent/10  text-accent-text font-semibold">{problem.points} points</span>
                                    <span className="px-2 py-1 rounded-md bg-tint-2 text-fg-2">Time limit {problem.timeLimitMs / 1000}s</span>
                                    {problem.memoryLimitMb && !isSql && <span className="px-2 py-1 rounded-md bg-tint-2 text-fg-2">Memory {problem.memoryLimitMb} MB</span>}
                                    {isSql && <span className="px-2 py-1 rounded-md bg-accent/10  text-accent-text font-semibold flex items-center gap-1"><Database size={12} /> SQL · SQLite + MySQL functions</span>}
                                    {isSql && <span className="px-2 py-1 rounded-md bg-tint-2 text-fg-2">{problem.orderMatters ? 'Row order matters' : 'Rows in any order'}</span>}
                                    <span className="px-2 py-1 rounded-md bg-tint-2 text-fg-2">{problem.testCount} test cases</span>
                                </div>
                                <Markdown>{problem.statement || '_No statement._'}</Markdown>
                                {isSql ? (
                                    <>
                                        {problem.sqlSchema && <div className="mt-5"><SampleBlock title="Schema" text={problem.sqlSchema} /></div>}
                                        <SqlDialectNotes />
                                        {problem.samples.map((sample, i) => <SqlSample key={i} index={i} sample={sample} />)}
                                    </>
                                ) : problem.samples.map((sample, i) => (
                                    <div key={i} className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <SampleBlock title={`Sample input ${i + 1}`} text={sample.input} />
                                        <SampleBlock title={`Sample output ${i + 1}`} text={sample.expectedOutput} />
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </section>

                {/* Editor + results */}
                <section className="flex-1 min-h-0 flex flex-col">
                    <div className="h-12 shrink-0 border-b border-line flex items-center gap-2 px-3">
                        {isSql ? (
                            <span
                                className="px-2.5 py-1.5 rounded-lg  bg-accent/10 text-accent-text text-sm font-semibold flex items-center gap-1.5"
                                title="SQLite, with common MySQL functions added (see SQL dialect notes under the schema)"
                            >
                                <Database size={14} /> SQL · SQLite
                            </span>
                        ) : (
                            <select
                                aria-label="Programming language"
                                value={language?.id ?? ''}
                                onChange={e => chooseLanguage(e.target.value)}
                                disabled={readOnly}
                                className="ui-field w-auto min-h-0 px-2.5 py-1.5 text-sm"
                            >
                                {contest.languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            </select>
                        )}
                        <span className="text-xs text-fg-3 font-mono">{path}</span>
                        <div className="flex-1" />
                        {readOnly ? (
                            <span className="text-sm text-fg-3 flex items-center gap-1.5"><Lock size={14} /> Contest ended: read-only</span>
                        ) : (
                            <>
                                <button onClick={runSamples} disabled={!ytext || running || submitting} className={`${panelButton} bg-tint-2 hover:bg-tint-3`}>
                                    {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run samples
                                </button>
                                <button onClick={submit} disabled={!ytext || submitting || !!judging} className={`${panelButton} bg-success-solid text-white hover:bg-success`}>
                                    {submitting || judging ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit
                                </button>
                            </>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        {path && (
                            <CodeEditor
                                path={path}
                                language={language ? monacoLanguageFor(language.id) : 'plaintext'}
                                ytext={ytext}
                                openPaths={openedPaths}
                                awareness={collab?.provider.awareness ?? null}
                                readOnly={readOnly}
                            />
                        )}
                        {!ytext && (
                            <div className={`absolute inset-0 z-[5] flex items-center justify-center p-6 text-center bg-canvas font-mono text-[13px] ${openError ? 'text-danger-text' : 'text-fg-3'}`}>
                                {openError ?? 'Opening your code…'}
                            </div>
                        )}
                    </div>

                    {/* Results panel */}
                    <div className="h-[38%] min-h-[180px] shrink-0 border-t border-line flex flex-col">
                        <div className="flex items-center gap-1 px-3 border-b border-line shrink-0">
                            {(['result', 'custom', 'submissions'] as Panel[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPanel(p)}
                                    className={`px-3 py-2.5 text-sm font-semibold border-b-2 ${panel === p ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg'}`}
                                >
                                    {p === 'result' ? 'Result' : p === 'custom' ? (isSql ? 'Custom data' : 'Custom input') : `Submissions (${problemSubmissions.length})`}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 text-sm">
                            {panelError && <div className="mb-3 rounded-lg  bg-danger/10 px-3 py-2 text-danger-text flex justify-between gap-3">{panelError}<button onClick={() => setPanelError('')}><X size={14} /></button></div>}
                            {panel === 'result' && (
                                activeSubmission ? <SubmissionView submission={activeSubmission} points={problem?.points ?? 0} />
                                    : activeSubmissionId ? <div className="text-fg-3 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting…</div>
                                    : runResult?.mode === 'samples' ? <SampleRunView result={runResult} />
                                    : runResult?.mode === 'custom' ? <CustomRunView result={runResult} />
                                    : <div className="text-fg-3">{isSql
                                        ? 'Run the samples to check your query, then submit it to be judged on every dataset.'
                                        : 'Run the samples to check your code, then submit it to be judged on all test cases.'}</div>
                            )}
                            {panel === 'custom' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            aria-label="Custom input"
                                            value={customInput}
                                            onChange={e => setCustomInput(e.target.value)}
                                            placeholder={isSql ? 'INSERT statements to run after the schema (the sample data is not included)' : 'Input (stdin)'}
                                            className="ui-field flex-1 min-h-[90px] p-2.5 font-mono text-xs"
                                        />
                                        <button onClick={runCustom} disabled={!ytext || running || readOnly} className={`${panelButton} self-start bg-tint-2 hover:bg-tint-3`}>
                                            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {isSql ? 'Run on this data' : 'Run with this input'}
                                        </button>
                                    </div>
                                    <div className="min-h-0 overflow-auto">
                                        {runResult?.mode === 'custom' ? <CustomRunView result={runResult} /> : <div className="text-fg-3 text-xs">{isSql ? 'Your query\'s result appears here.' : 'Output appears here.'}</div>}
                                    </div>
                                </div>
                            )}
                            {panel === 'submissions' && (
                                problemSubmissions.length === 0 ? <div className="text-fg-3">No submissions for this problem yet.</div> : (
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {problemSubmissions.map(s => (
                                                <tr
                                                    key={s.id}
                                                    onClick={() => { setActiveSubmissionId(s.id); setPanel('result'); }}
                                                    className="border-b border-line-faint cursor-pointer hover:bg-tint-1"
                                                >
                                                    <td className="py-2 pr-3 text-fg-3 tabular-nums">{new Date(s.createdAt).toLocaleTimeString()}</td>
                                                    <td className="py-2 pr-3 text-fg-2">{languageLabel(contest.languages, s.language)}</td>
                                                    <td className="py-2 pr-3">{s.verdict ? <VerdictBadge verdict={s.verdict} short /> : <span className="text-fg-3">{s.status.toLowerCase()}</span>}</td>
                                                    <td className="py-2 pr-3 text-fg-2 tabular-nums">{s.passed}/{s.total} tests</td>
                                                    <td className="py-2 text-right font-semibold tabular-nums">{formatScore(s.score)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Leaderboard drawer */}
            {showBoard && (
                <Overlay
                    label="Leaderboard"
                    onClose={() => setShowBoard(false)}
                    className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
                    panelClassName="w-full max-w-3xl h-full bg-surface border-l border-line p-5 overflow-y-auto"
                >
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold flex items-center gap-2"><Trophy size={20} className="text-accent-text" /> Leaderboard</h2>
                            <button onClick={() => setShowBoard(false)} className="p-2 rounded-lg hover:bg-tint-3" aria-label="Close leaderboard"><X size={18} /></button>
                        </div>
                        {!board ? <Loader2 className="animate-spin text-fg-3" /> : board.hidden ? (
                            <div className="text-fg-3 py-10 text-center">The organizer hides the leaderboard until the contest ends.</div>
                        ) : (
                            <Leaderboard rows={board.rows} problems={board.problems} startsAt={contest.startsAt} highlightUserId={user?.id} />
                        )}
                    </div>
                </Overlay>
            )}

            <ProctoringOverlay overlay={proctoring.overlay} onDismiss={proctoring.dismissOverlay} label="contest" maxStrikes={contest.maxTabSwitches} />
        </div>
    );
}

function SampleBlock({ title, text }: { title: string; text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="rounded-lg border border-line bg-canvas overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-line text-xs text-fg-3">
                {title}
                <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="flex items-center gap-1 hover:text-fg">
                    <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="p-3 font-mono text-xs text-fg whitespace-pre-wrap break-all max-h-56 overflow-auto">{text}</pre>
        </div>
    );
}

// SQL problems: a sample dataset's tables and the result the query should return
function SqlSample({ index, sample }: { index: number; sample: ParticipantProblem['samples'][number] }) {
    return (
        <div className="mt-5 rounded-lg border border-line bg-canvas p-3 space-y-3">
            <div className="text-xs font-semibold text-fg-3">Sample {index + 1}</div>
            {sample.tablesError && <div className="text-xs text-danger-text">{sample.tablesError}</div>}
            {(sample.tables ?? []).map(table => <ResultTable key={table.name} table={table} title={table.name} maxHeight={200} />)}
            {sample.expected && <ResultTable table={sample.expected} title="Expected result" maxHeight={200} tone="good" />}
            <details className="text-xs text-fg-3">
                <summary className="cursor-pointer hover:text-fg">Dataset as SQL</summary>
                <div className="mt-2"><SampleBlock title="INSERT statements" text={sample.input} /></div>
            </details>
        </div>
    );
}

// What participants can write: SQLite plus the MySQL functions the server adds (server/.../mysqlCompat.ts)
function SqlDialectNotes() {
    const code = 'font-mono text-accent-text/90';
    return (
        <details className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-fg-2">
            <summary className="cursor-pointer text-fg-2 hover:text-fg font-semibold">SQL dialect notes</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
                <p>Queries run on <b className="text-fg">SQLite</b>, with common <b className="text-fg">MySQL</b> functions added, so most MySQL queries work as written.</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>
                        <b className="text-fg">Works:</b> joins, <span className={code}>GROUP BY</span> / <span className={code}>HAVING</span>, subqueries,{' '}
                        <span className={code}>WITH</span>, window functions (<span className={code}>RANK</span>, <span className={code}>LAG</span>, …),{' '}
                        <span className={code}>LIMIT a, b</span>, <span className={code}>IF</span>, <span className={code}>IFNULL</span>, <span className={code}>CASE</span>,{' '}
                        <span className={code}>GROUP_CONCAT(x ORDER BY y)</span>, backtick names.
                    </li>
                    <li>
                        <b className="text-fg">MySQL functions:</b>{' '}
                        <span className={code}>CONCAT LEFT RIGHT LPAD RPAD LOCATE SUBSTRING_INDEX CHAR_LENGTH UCASE LCASE REPEAT REVERSE</span>,{' '}
                        <span className={code}>MOD TRUNCATE CEILING POW GREATEST LEAST</span>,{' '}
                        <span className={code}>NOW CURDATE YEAR MONTH DAY HOUR DAYNAME MONTHNAME QUARTER WEEKDAY DAYOFWEEK LAST_DAY DATEDIFF DATE_FORMAT ADDDATE SUBDATE</span>,{' '}
                        <span className={code}>REGEXP</span>, <span className={code}>REGEXP_LIKE</span>, <span className={code}>REGEXP_REPLACE</span>, <span className={code}>FROM DUAL</span>.
                    </li>
                    <li>
                        <b className="text-fg">Different from MySQL:</b> <span className={code}>5 / 2</span> is <span className={code}>2</span> (whole-number division; write{' '}
                        <span className={code}>5 * 1.0 / 2</span>). Text <span className={code}>=</span> is case-sensitive (<span className={code}>LIKE</span> and{' '}
                        <span className={code}>REGEXP</span> are not).
                    </li>
                    <li>
                        <b className="text-fg">Not supported:</b> <span className={code}>INTERVAL</span> (use <span className={code}>ADDDATE(d, 7)</span> or{' '}
                        <span className={code}>date(d, '+7 day')</span>), <span className={code}>GROUP_CONCAT(x SEPARATOR ';')</span> (use{' '}
                        <span className={code}>GROUP_CONCAT(x, ';')</span>), <span className={code}>DIV</span>, <span className={code}>&lt;=&gt;</span> (use{' '}
                        <span className={code}>IS</span>), <span className={code}>@variables</span>.
                    </li>
                </ul>
            </div>
        </details>
    );
}

// A query's result next to the expected one (null: the query returned none)
function SqlResult({ table, title }: { table: SqlTable | null | undefined; title: string }) {
    if (!table) {
        return (
            <div>
                <div className="text-xs text-fg-3 mb-1">{title}</div>
                <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-fg-3 italic">No result</div>
            </div>
        );
    }
    return <ResultTable table={table} title={title} maxHeight={220} />;
}

function OutputBlock({ title, text, tone = 'normal' }: { title: string; text: string; tone?: 'normal' | 'error' }) {
    if (!text) return null;
    return (
        <div>
            <div className="text-xs text-fg-3 mb-1">{title}</div>
            <pre className={`rounded-lg border p-2.5 font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto ${tone === 'error' ? ' bg-danger/10 text-danger-text' : 'border-line bg-canvas text-fg'}`}>{text}</pre>
        </div>
    );
}

const timeLabel = (ms: number | null, exact: boolean) => (ms === null ? '' : `${exact ? '' : '≈'}${ms} ms`);

function SubmissionView({ submission, points }: { submission: SubmissionDetail; points: number }) {
    const pending = submission.status === 'QUEUED' || submission.status === 'RUNNING';
    const chips = Array.from({ length: submission.total }, (_, i) => submission.results[i] ?? null);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                {submission.status === 'QUEUED' && <span className="flex items-center gap-2 text-fg-2"><Loader2 size={16} className="animate-spin" /> In queue{submission.queuePosition ? ` (#${submission.queuePosition})` : ''}…</span>}
                {submission.status === 'RUNNING' && <span className="flex items-center gap-2 text-accent-text"><Loader2 size={16} className="animate-spin" /> Judging test {Math.min(submission.results.length + 1, submission.total)} of {submission.total}…</span>}
                {submission.verdict && !pending && <VerdictBadge verdict={submission.verdict} className="text-sm px-3 py-1" />}
                {!pending && submission.status === 'DONE' && (
                    <span className="font-semibold tabular-nums">{formatScore(submission.score)} / {points} points · {submission.passed}/{submission.total} tests passed</span>
                )}
                {submission.status === 'ERROR' && <span className="text-fg-2">The judge couldn't run your code. This doesn't count against you; try submitting again.</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {chips.map((r, i) => (
                    <div
                        key={i}
                        className={`min-w-[64px] px-2 py-1.5 rounded-lg text-center ${r ? VERDICT_STYLE[r.verdict] : 'bg-tint-1 text-fg-3'}`}
                        title={r ? `Test ${i + 1}${r.sample ? ' (sample)' : ''}: ${r.verdict} ${timeLabel(r.timeMs, r.timeExact)}` : `Test ${i + 1}: waiting`}
                    >
                        <div className="text-[10px] opacity-70">#{i + 1}{r?.sample ? ' S' : ''}</div>
                        <div className="text-xs font-semibold">{r ? r.verdict : '…'}</div>
                        {r?.timeMs != null && <div className="text-[10px] opacity-70 tabular-nums">{timeLabel(r.timeMs, r.timeExact)}</div>}
                    </div>
                ))}
            </div>
            {submission.compileOutput && <OutputBlock title={submission.verdict === 'IE' ? 'Judge error' : 'Compiler output'} text={submission.compileOutput} tone="error" />}
            {submission.results.filter(r => r.sample && r.verdict !== 'AC' && (r.stdout || r.stderr || r.table !== undefined)).slice(0, 1).map((r, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {r.table !== undefined
                        ? <SqlResult table={r.table} title="Your result on a failed sample" />
                        : <OutputBlock title="Your output on a failed sample" text={r.stdout || ''} />}
                    <OutputBlock title="Errors" text={r.stderr || ''} tone="error" />
                </div>
            ))}
            <p className="text-xs text-fg-3">Hidden test cases only show their verdict. "S" marks sample tests.</p>
        </div>
    );
}

function SampleRunView({ result }: { result: Extract<RunResponse, { mode: 'samples' }> }) {
    return (
        <div className="space-y-4">
            {result.compileOutput && <OutputBlock title="Compiler output" text={result.compileOutput} tone="error" />}
            {result.results.map((r, i) => (
                <div key={i} className="rounded-lg border border-line p-3 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold">Sample {i + 1}</span>
                        <VerdictBadge verdict={r.verdict} short />
                        <span className="text-fg-3 text-xs tabular-nums">{timeLabel(r.timeMs, r.timeExact)}</span>
                    </div>
                    {r.expectedTable !== undefined ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <SqlResult table={r.expectedTable} title="Expected" />
                            <SqlResult table={r.table} title="Your result" />
                        </div>
                    ) : r.verdict !== 'CE' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <OutputBlock title="Input" text={r.input || ' '} />
                            <OutputBlock title="Expected" text={r.expected || ' '} />
                            <OutputBlock title="Your output" text={r.stdout || ' '} />
                        </div>
                    )}
                    <OutputBlock title="Errors" text={r.stderr || r.message || ''} tone="error" />
                </div>
            ))}
            {result.results.length < result.totalSamples && <p className="text-xs text-fg-3">Stopped after the first failing sample.</p>}
        </div>
    );
}

function CustomRunView({ result }: { result: Extract<RunResponse, { mode: 'custom' }> }) {
    const failed = result.kind !== 'ok';
    const isSql = result.table !== undefined;
    const label: Record<string, string> = { ce: 'Compilation error', re: isSql ? 'SQL error' : 'Runtime error', tle: 'Time limit exceeded', mle: 'Memory limit exceeded', ole: 'Output limit exceeded', ie: 'Judge error' };
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
                <span className={failed ? 'text-danger-text font-semibold' : 'text-success-text font-semibold'}>{failed ? label[result.kind] ?? result.kind : 'Finished'}</span>
                <span className="text-fg-3 tabular-nums">{timeLabel(result.timeMs, result.timeExact)}</span>
            </div>
            <OutputBlock title="Compiler output" text={result.compileOutput} tone="error" />
            {isSql
                ? !failed && <SqlResult table={result.table} title="Your result" />
                : <OutputBlock title="Output" text={result.stdout || (failed ? '' : '(no output)')} />}
            <OutputBlock title="Errors" text={result.stderr || result.message || ''} tone="error" />
        </div>
    );
}
