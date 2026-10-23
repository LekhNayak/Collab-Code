import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type * as Y from 'yjs';
import {
    ArrowLeft, Ban, CheckCircle2, Clock, Copy, Loader2, LogIn, Play, Send, Trophy, X, Lock, FlaskConical, ListChecks,
} from 'lucide-react';
import CodeEditor from '../components/Editor';
import Markdown from '../components/contest/Markdown';
import Countdown from '../components/contest/Countdown';
import Leaderboard from '../components/contest/Leaderboard';
import VerdictBadge from '../components/contest/VerdictBadge';
import ProctoringOverlay from '../components/ProctoringOverlay';
import { useCollabWorkspace, openCollabFile } from '../collab/useCollabWorkspace';
import { useProctoring } from '../hooks/useProctoring';
import { getTokenUser } from '../auth';
import { monacoLanguageFor, solutionPath, type ContestLanguageInfo } from '../contest/languages';
import {
    contestApi, errorMessage, formatScore, PHASE_LABEL, PHASE_STYLE, VERDICT_STYLE,
    type LeaderboardProblem, type LeaderboardRow, type ParticipantProblem, type ResolveResponse, type RunResponse,
    type SubmissionDetail, type SubmissionSummary,
} from '../contestApi';

const panelButton = 'px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40';

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
                        <div className="text-red-300 text-lg mb-6">{error}</div>
                        <button onClick={() => navigate('/contests')} className={`${panelButton} mx-auto bg-white/10 border border-white/15`}><ArrowLeft size={16} /> Contests</button>
                    </div>
                ) : <Loader2 className="animate-spin text-white/40" size={32} />}
            </Screen>
        );
    }

    const { contest, participant, isOwner, isGuest } = info;
    const status = participant?.status;

    if (isGuest) {
        return (
            <Lobby info={info} offsetMs={clockOffset} onBack={() => navigate('/contests')}>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm">
                    Contests need an account so your submissions and score can be saved. Log out and register or sign in, then open this contest again.
                </div>
            </Lobby>
        );
    }

    if (status === 'BLOCKED' || status === 'REMOVED') {
        return (
            <Screen>
                <div className="max-w-md w-full bg-white/5 border border-red-500/30 rounded-2xl p-10 text-center">
                    <Ban size={44} className="mx-auto text-red-400 mb-5" />
                    <h1 className="text-2xl font-black text-red-400 mb-3">{status === 'BLOCKED' ? 'You have been blocked' : 'You have been removed'}</h1>
                    <p className="text-white/60 mb-8">{participant?.blockedReason || 'Contact the organizer if you think this is a mistake.'}</p>
                    <button onClick={() => navigate('/contests')} className={`${panelButton} mx-auto bg-white/10 border border-white/15`}><ArrowLeft size={16} /> Contests</button>
                </div>
            </Screen>
        );
    }

    const started = contest.phase === 'LIVE' || contest.phase === 'ENDED';
    if (!isOwner && (!participant || !started)) {
        return (
            <Lobby info={info} offsetMs={clockOffset} onBack={() => navigate('/contests')}>
                {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 text-sm">{error}</div>}
                {participant ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold">
                        <CheckCircle2 size={20} /> You're registered. {contest.phase === 'DRAFT' ? 'Waiting for the organizer to start the contest.' : 'Problems unlock when the countdown ends.'}
                    </div>
                ) : contest.phase === 'ENDED' ? (
                    <div className="text-center text-white/50">This contest has ended.</div>
                ) : (
                    <button onClick={join} disabled={joining} className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                        <LogIn size={18} /> {joining ? 'Joining…' : 'Join contest'}
                    </button>
                )}
            </Lobby>
        );
    }

    return <Arena info={info} offsetMs={clockOffset} onReload={load} />;
}

function Screen({ children }: { children: React.ReactNode }) {
    return <div className="h-[100dvh] w-full bg-[#0a0a0c] text-white flex items-center justify-center p-6">{children}</div>;
}

function Lobby({ info, offsetMs, onBack, children }: { info: ResolveResponse; offsetMs: number; onBack: () => void; children: React.ReactNode }) {
    const { contest } = info;
    return (
        <div className="min-h-[100dvh] w-full bg-[#0a0a0c] text-white overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-10">
                <button onClick={onBack} className="mb-8 flex items-center gap-2 text-white/50 hover:text-white text-sm"><ArrowLeft size={16} /> Contests</button>
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-[#f59e0b]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.35)]"><Trophy size={28} /></div>
                        <div>
                            <h1 className="text-3xl font-extrabold leading-tight">{contest.title}</h1>
                            <div className="text-white/50 text-sm">by {contest.organizer} · <span className="font-mono">{contest.code}</span></div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-black/30 border border-white/10 p-6 text-center mb-6">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md border mb-3 ${PHASE_STYLE[contest.phase]}`}>{PHASE_LABEL[contest.phase]}</span>
                        {contest.phase === 'SCHEDULED' && (
                            <>
                                <div className="text-white/50 text-sm mb-1">Starts in</div>
                                <Countdown target={contest.startsAt} offsetMs={offsetMs} className="text-5xl font-black text-amber-200" />
                                <div className="text-white/40 text-sm mt-2">{new Date(contest.startsAt!).toLocaleString()}</div>
                            </>
                        )}
                        {contest.phase === 'DRAFT' && <div className="text-white/60">Not scheduled yet</div>}
                        {contest.phase === 'LIVE' && (
                            <><div className="text-white/50 text-sm mb-1">Running · ends in</div><Countdown target={contest.endsAt} offsetMs={offsetMs} className="text-4xl font-black text-emerald-300" /></>
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
                        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-100/90 mb-6 flex gap-2.5">
                            <Lock size={16} className="shrink-0 mt-0.5 text-red-300" />
                            Proctored: the contest runs in fullscreen, and tab switches are recorded. You'll be blocked after {contest.maxTabSwitches} tab switches.
                        </div>
                    )}

                    {contest.description && <div className="mb-6"><Markdown>{contest.description}</Markdown></div>}

                    <div className="space-y-3">{children}</div>
                </div>
                <p className="text-center text-white/30 text-xs mt-6">
                    Each problem's points are split evenly across its test cases. Your best submission per problem counts; ties go to whoever reached their score first.
                </p>
            </div>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-black/20 border border-white/5 px-3.5 py-2.5">
            <div className="text-white/40 text-xs uppercase tracking-wider">{label}</div>
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
    const language: ContestLanguageInfo | null = contest.languages.find(l => l.id === languageId) ?? contest.languages[0] ?? null;
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
        <div className="h-[100dvh] w-full bg-[#0a0a0c] text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-14 shrink-0 border-b border-white/10 flex items-center gap-4 px-4">
                <button onClick={() => navigate('/contests')} className="p-2 rounded-lg hover:bg-white/10 text-white/60" title="Leave"><ArrowLeft size={18} /></button>
                <Trophy size={18} className="text-amber-400 shrink-0" />
                <div className="font-bold truncate">{contest.title}</div>
                {isOwner && <span className="text-xs font-semibold px-2 py-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-200 flex items-center gap-1 shrink-0"><FlaskConical size={12} /> Organizer test mode: not ranked</span>}
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-white/40" />
                    {contest.phase === 'LIVE' ? <Countdown target={contest.endsAt} offsetMs={offsetMs} className="font-bold text-emerald-300" /> : <span className="text-white/50">{PHASE_LABEL[contest.phase]}</span>}
                </div>
                <div className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 tabular-nums">
                    {formatScore(totalScore)} <span className="text-white/40">/ {maxScore}</span>
                </div>
                <button onClick={() => setShowBoard(true)} className={`${panelButton} bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25`}>
                    <ListChecks size={16} /> Leaderboard
                </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                {/* Problem */}
                <section className="lg:w-[42%] min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10">
                    <div className="flex gap-1 px-3 pt-3 overflow-x-auto shrink-0">
                        {problems.map(p => {
                            const score = best[p.id];
                            const solved = score !== undefined && score >= p.points;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setProblemId(p.id)}
                                    className={`px-3.5 py-2 rounded-t-lg text-sm font-bold border-b-2 transition-colors ${p.id === problemId ? 'bg-white/[0.06] border-amber-400 text-white' : 'border-transparent text-white/50 hover:text-white'}`}
                                >
                                    {p.index}
                                    {score !== undefined && <span className={`ml-1.5 text-xs ${solved ? 'text-emerald-300' : 'text-amber-300'}`}>{formatScore(score)}</span>}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto p-5 bg-white/[0.02]">
                        {!problem ? (
                            <div className="text-white/40">{panelError || 'Loading problems…'}</div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-extrabold mb-2">{problem.index}. {problem.title}</h1>
                                <div className="flex flex-wrap gap-2 text-xs mb-5">
                                    <span className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-200 font-semibold">{problem.points} points</span>
                                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">Time limit {problem.timeLimitMs / 1000}s</span>
                                    {problem.memoryLimitMb && <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">Memory {problem.memoryLimitMb} MB</span>}
                                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/60">{problem.testCount} test cases</span>
                                </div>
                                <Markdown>{problem.statement || '_No statement._'}</Markdown>
                                {problem.samples.map((sample, i) => (
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
                    <div className="h-12 shrink-0 border-b border-white/10 flex items-center gap-2 px-3">
                        <select
                            value={language?.id ?? ''}
                            onChange={e => chooseLanguage(e.target.value)}
                            disabled={readOnly}
                            className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-amber-500/50"
                        >
                            {contest.languages.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <span className="text-xs text-white/30 font-mono">{path}</span>
                        <div className="flex-1" />
                        {readOnly ? (
                            <span className="text-sm text-white/50 flex items-center gap-1.5"><Lock size={14} /> Contest ended: read-only</span>
                        ) : (
                            <>
                                <button onClick={runSamples} disabled={!ytext || running || submitting} className={`${panelButton} bg-white/10 border border-white/15 hover:bg-white/20`}>
                                    {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run samples
                                </button>
                                <button onClick={submit} disabled={!ytext || submitting || !!judging} className={`${panelButton} bg-emerald-500 text-black hover:bg-emerald-400`}>
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
                            <div className={`absolute inset-0 z-[5] flex items-center justify-center p-6 text-center bg-[#0a0a0c] font-mono text-[13px] ${openError ? 'text-red-300' : 'text-white/40'}`}>
                                {openError ?? 'Opening your code…'}
                            </div>
                        )}
                    </div>

                    {/* Results panel */}
                    <div className="h-[38%] min-h-[180px] shrink-0 border-t border-white/10 flex flex-col">
                        <div className="flex items-center gap-1 px-3 border-b border-white/10 shrink-0">
                            {(['result', 'custom', 'submissions'] as Panel[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPanel(p)}
                                    className={`px-3 py-2.5 text-sm font-semibold border-b-2 ${panel === p ? 'border-amber-400 text-white' : 'border-transparent text-white/50 hover:text-white'}`}
                                >
                                    {p === 'result' ? 'Result' : p === 'custom' ? 'Custom input' : `Submissions (${problemSubmissions.length})`}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-4 text-sm">
                            {panelError && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200 flex justify-between gap-3">{panelError}<button onClick={() => setPanelError('')}><X size={14} /></button></div>}
                            {panel === 'result' && (
                                activeSubmission ? <SubmissionView submission={activeSubmission} points={problem?.points ?? 0} />
                                    : activeSubmissionId ? <div className="text-white/50 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting…</div>
                                    : runResult?.mode === 'samples' ? <SampleRunView result={runResult} />
                                    : runResult?.mode === 'custom' ? <CustomRunView result={runResult} />
                                    : <div className="text-white/40">Run the samples to check your code, then submit it to be judged on all test cases.</div>
                            )}
                            {panel === 'custom' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={customInput}
                                            onChange={e => setCustomInput(e.target.value)}
                                            placeholder="Input (stdin)"
                                            className="flex-1 min-h-[90px] bg-black/40 border border-white/10 rounded-lg p-2.5 font-mono text-xs outline-none focus:border-amber-500/50"
                                        />
                                        <button onClick={runCustom} disabled={!ytext || running || readOnly} className={`${panelButton} self-start bg-white/10 border border-white/15 hover:bg-white/20`}>
                                            {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Run with this input
                                        </button>
                                    </div>
                                    <div className="min-h-0 overflow-auto">
                                        {runResult?.mode === 'custom' ? <CustomRunView result={runResult} /> : <div className="text-white/40 text-xs">Output appears here.</div>}
                                    </div>
                                </div>
                            )}
                            {panel === 'submissions' && (
                                problemSubmissions.length === 0 ? <div className="text-white/40">No submissions for this problem yet.</div> : (
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {problemSubmissions.map(s => (
                                                <tr
                                                    key={s.id}
                                                    onClick={() => { setActiveSubmissionId(s.id); setPanel('result'); }}
                                                    className="border-b border-white/5 cursor-pointer hover:bg-white/5"
                                                >
                                                    <td className="py-2 pr-3 text-white/50 tabular-nums">{new Date(s.createdAt).toLocaleTimeString()}</td>
                                                    <td className="py-2 pr-3 text-white/60">{contest.languages.find(l => l.id === s.language)?.label ?? s.language}</td>
                                                    <td className="py-2 pr-3">{s.verdict ? <VerdictBadge verdict={s.verdict} short /> : <span className="text-white/40">{s.status.toLowerCase()}</span>}</td>
                                                    <td className="py-2 pr-3 text-white/60 tabular-nums">{s.passed}/{s.total} tests</td>
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
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setShowBoard(false)}>
                    <div className="w-full max-w-3xl h-full bg-[#111114] border-l border-white/10 p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Trophy size={20} className="text-amber-400" /> Leaderboard</h2>
                            <button onClick={() => setShowBoard(false)} className="p-2 rounded-lg hover:bg-white/10"><X size={18} /></button>
                        </div>
                        {!board ? <Loader2 className="animate-spin text-white/40" /> : board.hidden ? (
                            <div className="text-white/50 py-10 text-center">The organizer hides the leaderboard until the contest ends.</div>
                        ) : (
                            <Leaderboard rows={board.rows} problems={board.problems} startsAt={contest.startsAt} highlightUserId={user?.id} />
                        )}
                    </div>
                </div>
            )}

            <ProctoringOverlay overlay={proctoring.overlay} onDismiss={proctoring.dismissOverlay} label="contest" maxStrikes={contest.maxTabSwitches} />
        </div>
    );
}

function SampleBlock({ title, text }: { title: string; text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-xs text-white/50">
                {title}
                <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); }} className="flex items-center gap-1 hover:text-white">
                    <Copy size={12} /> {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="p-3 font-mono text-xs text-white/85 whitespace-pre-wrap break-all max-h-56 overflow-auto">{text}</pre>
        </div>
    );
}

function OutputBlock({ title, text, tone = 'normal' }: { title: string; text: string; tone?: 'normal' | 'error' }) {
    if (!text) return null;
    return (
        <div>
            <div className="text-xs text-white/40 mb-1">{title}</div>
            <pre className={`rounded-lg border p-2.5 font-mono text-xs whitespace-pre-wrap break-all max-h-48 overflow-auto ${tone === 'error' ? 'border-red-500/20 bg-red-500/[0.06] text-red-200' : 'border-white/10 bg-black/40 text-white/85'}`}>{text}</pre>
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
                {submission.status === 'QUEUED' && <span className="flex items-center gap-2 text-white/60"><Loader2 size={16} className="animate-spin" /> In queue{submission.queuePosition ? ` (#${submission.queuePosition})` : ''}…</span>}
                {submission.status === 'RUNNING' && <span className="flex items-center gap-2 text-sky-300"><Loader2 size={16} className="animate-spin" /> Judging test {Math.min(submission.results.length + 1, submission.total)} of {submission.total}…</span>}
                {submission.verdict && !pending && <VerdictBadge verdict={submission.verdict} className="text-sm px-3 py-1" />}
                {!pending && submission.status === 'DONE' && (
                    <span className="font-semibold tabular-nums">{formatScore(submission.score)} / {points} points · {submission.passed}/{submission.total} tests passed</span>
                )}
                {submission.status === 'ERROR' && <span className="text-white/60">The judge couldn't run your code. This doesn't count against you; try submitting again.</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {chips.map((r, i) => (
                    <div
                        key={i}
                        className={`min-w-[64px] px-2 py-1.5 rounded-lg border text-center ${r ? VERDICT_STYLE[r.verdict] : 'border-white/10 bg-white/[0.03] text-white/30'}`}
                        title={r ? `Test ${i + 1}${r.sample ? ' (sample)' : ''}: ${r.verdict} ${timeLabel(r.timeMs, r.timeExact)}` : `Test ${i + 1}: waiting`}
                    >
                        <div className="text-[10px] opacity-70">#{i + 1}{r?.sample ? ' S' : ''}</div>
                        <div className="text-xs font-bold">{r ? r.verdict : '…'}</div>
                        {r?.timeMs != null && <div className="text-[10px] opacity-70 tabular-nums">{timeLabel(r.timeMs, r.timeExact)}</div>}
                    </div>
                ))}
            </div>
            {submission.compileOutput && <OutputBlock title={submission.verdict === 'IE' ? 'Judge error' : 'Compiler output'} text={submission.compileOutput} tone="error" />}
            {submission.results.filter(r => r.sample && r.verdict !== 'AC' && (r.stdout || r.stderr)).slice(0, 1).map((r, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <OutputBlock title="Your output on a failed sample" text={r.stdout || ''} />
                    <OutputBlock title="Errors" text={r.stderr || ''} tone="error" />
                </div>
            ))}
            <p className="text-xs text-white/30">Hidden test cases only show their verdict. "S" marks sample tests.</p>
        </div>
    );
}

function SampleRunView({ result }: { result: Extract<RunResponse, { mode: 'samples' }> }) {
    return (
        <div className="space-y-4">
            {result.compileOutput && <OutputBlock title="Compiler output" text={result.compileOutput} tone="error" />}
            {result.results.map((r, i) => (
                <div key={i} className="rounded-xl border border-white/10 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold">Sample {i + 1}</span>
                        <VerdictBadge verdict={r.verdict} short />
                        <span className="text-white/40 text-xs tabular-nums">{timeLabel(r.timeMs, r.timeExact)}</span>
                    </div>
                    {r.verdict !== 'CE' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <OutputBlock title="Input" text={r.input || ' '} />
                            <OutputBlock title="Expected" text={r.expected || ' '} />
                            <OutputBlock title="Your output" text={r.stdout || ' '} />
                        </div>
                    )}
                    <OutputBlock title="Errors" text={r.stderr || r.message || ''} tone="error" />
                </div>
            ))}
            {result.results.length < result.totalSamples && <p className="text-xs text-white/40">Stopped after the first failing sample.</p>}
        </div>
    );
}

function CustomRunView({ result }: { result: Extract<RunResponse, { mode: 'custom' }> }) {
    const failed = result.kind !== 'ok';
    const label: Record<string, string> = { ce: 'Compilation error', re: 'Runtime error', tle: 'Time limit exceeded', mle: 'Memory limit exceeded', ole: 'Output limit exceeded', ie: 'Judge error' };
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
                <span className={failed ? 'text-red-300 font-semibold' : 'text-emerald-300 font-semibold'}>{failed ? label[result.kind] ?? result.kind : 'Finished'}</span>
                <span className="text-white/40 tabular-nums">{timeLabel(result.timeMs, result.timeExact)}</span>
            </div>
            <OutputBlock title="Compiler output" text={result.compileOutput} tone="error" />
            <OutputBlock title="Output" text={result.stdout || (failed ? '' : '(no output)')} />
            <OutputBlock title="Errors" text={result.stderr || result.message || ''} tone="error" />
        </div>
    );
}
