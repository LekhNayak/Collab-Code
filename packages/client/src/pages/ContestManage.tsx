import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Activity, CalendarClock, Copy, Eye, FileUp, Pencil, Play, Plus, RefreshCw, Save, Square,
    Trash2, Trophy, X, AlertTriangle, Clock, FolderUp, Code2, Database,
} from 'lucide-react';
import Markdown from '../components/contest/Markdown';
import ResultTable from '../components/contest/ResultTable';
import {
    contestApi, errorMessage, formatDuration, PHASE_LABEL, PHASE_STYLE,
    type AdminProblem, type ContestSummary, type ProblemKind, type SqlTable, type TestMeta,
} from '../contestApi';
import { useServerClock, msUntil } from '../contest/clock';
import { useDialog } from '../contexts/dialog';
import { useToast } from '../contexts/toast';

type AdminData = Awaited<ReturnType<typeof contestApi.admin>>;
type JudgeInfo = Awaited<ReturnType<typeof contestApi.judgeInfo>>;

const inputClass = 'w-full bg-black/30 border border-white/10 px-3 py-2 rounded-lg outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/15 text-sm';
const labelClass = 'block text-xs font-semibold text-white/50 uppercase tracking-wider mb-1.5';
const buttonClass = 'px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40';
const cardClass = 'bg-white/[0.04] border border-white/10 rounded-2xl';

// datetime-local value for a date, in local time
const toLocalInput = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`);

// Expected output of an SQL test: the reference query's result as JSON
function parseTable(json: string): SqlTable | null {
    try {
        const value = JSON.parse(json);
        return value && Array.isArray(value.columns) && Array.isArray(value.rows) ? value : null;
    } catch {
        return null;
    }
}

const SQL_STARTER_SCHEMA = `CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    salary INTEGER
);
`;

export default function ContestManage() {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<AdminData | null>(null);
    const [judge, setJudge] = useState<JudgeInfo | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [scheduleAt, setScheduleAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)));
    const [copied, setCopied] = useState(false);
    const { now, sync } = useServerClock();
    const dialog = useDialog();

    const refresh = useCallback(async () => {
        try {
            const next = await contestApi.admin(id);
            setData(next);
            sync(next.serverNow);
            setSelectedId(current => current && next.problems.some(p => p.id === current) ? current : next.problems[0]?.id ?? null);
        } catch (err) {
            setError(errorMessage(err));
        }
    }, [id, sync]);

    useEffect(() => {
        refresh();
        contestApi.judgeInfo(id).then(setJudge).catch(() => {});
    }, [id, refresh]);

    const flash = (message: string) => toast.success(message);

    // Runs an action, shows its error, and reloads the contest
    const act = async (action: () => Promise<unknown>, success?: string) => {
        setBusy(true);
        setError('');
        try {
            await action();
            if (success) flash(success);
            await refresh();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (!data) {
        return (
            <div className="h-[100dvh] bg-black text-white flex items-center justify-center">
                {error ? <div className="text-red-300">{error}</div> : <div className="text-white/50">Loading contest…</div>}
            </div>
        );
    }

    const { contest, problems } = data;
    const selected = problems.find(p => p.id === selectedId) ?? null;
    const phase = contest.phase;

    const addProblem = (kind: ProblemKind) => act(async () => {
        const problem = await contestApi.addProblem(contest.id, {
            title: `Problem ${String.fromCharCode(65 + problems.length)}`,
            statement: '',
            points: 100,
            timeLimitMs: 2000,
            ...(kind === 'SQL' ? { kind, sqlSchema: SQL_STARTER_SCHEMA } : {}),
        });
        setSelectedId(problem.id);
    }, kind === 'SQL' ? 'SQL problem added' : 'Problem added');

    return (
        <div className="h-[100dvh] w-full bg-[#0a0a0c] text-white overflow-y-auto">
            <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4 justify-between mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={() => navigate('/contests')} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" title="All contests">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-11 h-11 bg-[#f59e0b]/90 rounded-xl flex items-center justify-center shrink-0"><Trophy size={22} /></div>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-extrabold truncate">{contest.title}</h1>
                            <div className="flex items-center gap-2 text-sm text-white/50 mt-0.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${PHASE_STYLE[phase]}`}>{PHASE_LABEL[phase]}</span>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(contest.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                                    className="font-mono text-amber-200 hover:text-amber-100 flex items-center gap-1"
                                    title="Copy the code participants use to join"
                                >
                                    {contest.code} <Copy size={13} /> {copied && <span className="text-xs text-white/50">copied</span>}
                                </button>
                                <span>· {data.participantCount} joined · {data.submissionCount} submissions</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => navigate(`/c/${contest.code}`)} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`} title="Open the contest as a participant would see it (your submissions don't count)">
                            <Eye size={16} /> Try it
                        </button>
                        <button onClick={() => navigate(`/contests/${contest.id}/monitor`)} className={`${buttonClass} bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25`}>
                            <Activity size={16} /> Monitor
                        </button>
                        <button
                            disabled={busy}
                            onClick={async () => {
                                const ok = await dialog.confirm({
                                    title: `Delete "${contest.title}"?`,
                                    message: "Problems, test cases, submissions and participants' code are removed permanently. This can't be undone.",
                                    confirmLabel: 'Delete contest',
                                    tone: 'danger',
                                    icon: <Trash2 size={26} />,
                                });
                                if (ok) {
                                    contestApi.remove(contest.id)
                                        .then(() => {
                                            toast.success('Contest deleted', `"${contest.title}" was deleted.`);
                                            navigate('/contests');
                                        })
                                        .catch(err => setError(errorMessage(err)));
                                }
                            }}
                            className={`${buttonClass} bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20`}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                </div>

                {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex justify-between">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}

                {judge?.backend === 'wandbox' && problems.some(p => p.kind !== 'SQL') && (
                    <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-amber-100/90 text-sm flex gap-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-300" />
                        <div>
                            Judging runs on the free Wandbox API: about 9 test runs per minute for the whole server, and time limits are approximate
                            (compile and network time included). Fine for trying things out; for a real contest, run Piston and set <code className="text-amber-200">PISTON_URL</code> on the server.
                            Keep tests few and order them small to large{judge.stopAfterTle ? ' (after a time-out the remaining tests are skipped)' : ''}.
                        </div>
                    </div>
                )}

                {/* Schedule */}
                <div className={`${cardClass} p-5 mb-6`}>
                    <div className="flex flex-wrap items-center gap-x-8 gap-y-4 justify-between">
                        <div className="flex items-center gap-3">
                            <Clock size={20} className="text-white/40" />
                            {phase === 'DRAFT' && <div><div className="font-semibold">Not scheduled</div><div className="text-sm text-white/50">Runs for {contest.durationMinutes} minutes once started.</div></div>}
                            {phase === 'SCHEDULED' && <div><div className="font-semibold">Starts in {formatDuration(msUntil(contest.startsAt, now))}</div><div className="text-sm text-white/50">{new Date(contest.startsAt!).toLocaleString()} · {contest.durationMinutes} min</div></div>}
                            {phase === 'LIVE' && <div><div className="font-semibold text-emerald-300">Live · {formatDuration(msUntil(contest.endsAt, now))} left</div><div className="text-sm text-white/50">Ends {new Date(contest.endsAt!).toLocaleString()}</div></div>}
                            {phase === 'ENDED' && <div><div className="font-semibold">Ended</div><div className="text-sm text-white/50">{new Date(contest.endsAt!).toLocaleString()}</div></div>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {(phase === 'DRAFT' || phase === 'SCHEDULED') && (
                                <>
                                    <input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} className={`${inputClass} w-auto`} />
                                    <button disabled={busy} onClick={() => act(() => contestApi.start(contest.id, new Date(scheduleAt).toISOString()), 'Contest scheduled')} className={`${buttonClass} bg-sky-500/15 border border-sky-500/30 text-sky-200 hover:bg-sky-500/25`}>
                                        <CalendarClock size={16} /> {phase === 'SCHEDULED' ? 'Reschedule' : 'Schedule'}
                                    </button>
                                    {phase === 'SCHEDULED' && (
                                        <button disabled={busy} onClick={() => act(() => contestApi.unschedule(contest.id), 'Back to draft')} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}>
                                            Unschedule
                                        </button>
                                    )}
                                    <button
                                        disabled={busy}
                                        onClick={async () => {
                                            const ok = await dialog.confirm({
                                                title: 'Start the contest now?',
                                                message: `Participants can see the problems immediately. It runs for ${contest.durationMinutes} minutes.`,
                                                confirmLabel: 'Start now',
                                                tone: 'success',
                                                icon: <Play size={26} />,
                                            });
                                            if (ok) act(() => contestApi.start(contest.id), 'Contest started');
                                        }}
                                        className={`${buttonClass} bg-emerald-500 text-black hover:bg-emerald-400`}
                                    >
                                        <Play size={16} /> Start now
                                    </button>
                                </>
                            )}
                            {phase === 'LIVE' && (
                                <>
                                    <button disabled={busy} onClick={() => act(() => contestApi.update(contest.id, { durationMinutes: contest.durationMinutes + 15 }), 'Extended by 15 minutes')} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}>
                                        <Plus size={16} /> 15 min
                                    </button>
                                    <button
                                        disabled={busy}
                                        onClick={async () => {
                                            const ok = await dialog.confirm({
                                                title: 'End the contest now?',
                                                message: 'Participants can no longer submit. Submissions already queued are still judged.',
                                                confirmLabel: 'End contest',
                                                tone: 'danger',
                                                icon: <Square size={26} />,
                                            });
                                            if (ok) act(() => contestApi.end(contest.id), 'Contest ended');
                                        }}
                                        className={`${buttonClass} bg-red-500/80 hover:bg-red-500`}
                                    >
                                        <Square size={16} /> End now
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6">
                    <SettingsCard key={contest.id} contest={contest} judge={judge} busy={busy} onSave={settings => act(() => contestApi.update(contest.id, settings), 'Settings saved')} />

                    <div className={`${cardClass} p-5`}>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold">Problems</h2>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    disabled={busy}
                                    onClick={() => addProblem('SQL')}
                                    className={`${buttonClass} bg-sky-500/15 border border-sky-500/30 text-sky-200 hover:bg-sky-500/25`}
                                    title="Participants answer with one SQLite query, judged on a dataset per test"
                                >
                                    <Database size={16} /> Add SQL problem
                                </button>
                                <button disabled={busy} onClick={() => addProblem('CODE')} className={`${buttonClass} bg-amber-500 text-black hover:bg-amber-400`}>
                                    <Plus size={16} /> Add problem
                                </button>
                            </div>
                        </div>
                        {problems.length === 0 ? (
                            <div className="text-white/40 text-sm py-10 text-center">No problems yet. Add one to start writing its statement and test cases.</div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-2 mb-5">
                                    {problems.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setSelectedId(p.id)}
                                            className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${p.id === selectedId ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/80'}`}
                                        >
                                            <span className="font-bold mr-1.5">{p.index}</span>{p.title}
                                            {p.kind === 'SQL' && <span className="ml-2 px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-200 text-[10px] font-bold">SQL</span>}
                                            <span className={`ml-2 text-xs ${p.tests.length === 0 ? 'text-red-300' : 'text-white/40'}`}>{p.tests.length} tests</span>
                                        </button>
                                    ))}
                                </div>
                                {selected && (
                                    <ProblemEditor
                                        key={`${selected.id}:${selected.kind}`} // fresh fields after a type change
                                        contest={contest}
                                        problem={selected}
                                        judge={judge}
                                        busy={busy}
                                        act={act}
                                        onError={setError}
                                        refresh={refresh}
                                    />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function SettingsCard({ contest, judge, busy, onSave }: {
    contest: ContestSummary;
    judge: JudgeInfo | null;
    busy: boolean;
    onSave: (settings: Parameters<typeof contestApi.update>[1]) => void;
}) {
    const [title, setTitle] = useState(contest.title);
    const [description, setDescription] = useState(contest.description);
    const [duration, setDuration] = useState(String(contest.durationMinutes));
    const [languages, setLanguages] = useState<string[]>(contest.allowedLanguageIds);
    const [leaderboard, setLeaderboard] = useState(contest.leaderboard);
    const [proctoring, setProctoring] = useState(contest.proctoring);
    const [maxTabSwitches, setMaxTabSwitches] = useState(String(contest.maxTabSwitches));

    const toggleLanguage = (id: string) => setLanguages(list => (list.includes(id) ? list.filter(l => l !== id) : [...list, id]));

    return (
        <div className={`${cardClass} p-5 h-fit`}>
            <h2 className="text-lg font-bold mb-4">Settings</h2>
            <div className="space-y-4">
                <div>
                    <label className={labelClass}>Title</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Description (markdown, shown in the lobby)</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className={`${inputClass} font-mono text-xs`} placeholder="Rules, prizes, scoring notes…" />
                </div>
                <div>
                    <label className={labelClass}>Duration (minutes)</label>
                    <input type="number" min={5} value={duration} onChange={e => setDuration(e.target.value)} disabled={contest.phase === 'ENDED'} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Languages {languages.length === 0 && <span className="normal-case text-white/40">(all allowed)</span>}</label>
                    <div className="flex flex-wrap gap-1.5">
                        {(judge?.languages ?? contest.languages).map(l => (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => toggleLanguage(l.id)}
                                className={`px-2.5 py-1 rounded-md border text-xs font-semibold ${languages.includes(l.id) ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' : 'bg-white/5 border-white/10 text-white/60'}`}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className={labelClass}>Leaderboard</label>
                    <select value={leaderboard} onChange={e => setLeaderboard(e.target.value as 'LIVE' | 'AFTER_END')} className={inputClass}>
                        <option value="LIVE">Visible to participants during the contest</option>
                        <option value="AFTER_END">Hidden until the contest ends</option>
                    </select>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <label className="flex items-center gap-2.5 text-sm font-semibold cursor-pointer">
                        <input type="checkbox" checked={proctoring} onChange={e => setProctoring(e.target.checked)} className="accent-amber-500 w-4 h-4" />
                        Proctoring
                    </label>
                    <p className="text-xs text-white/45 mt-1.5">Requires fullscreen and records tab switches, fullscreen exits and large pastes. Participants are blocked after too many tab switches.</p>
                    {proctoring && (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                            Block after
                            <input type="number" min={1} value={maxTabSwitches} onChange={e => setMaxTabSwitches(e.target.value)} className={`${inputClass} w-20`} />
                            tab switches
                        </div>
                    )}
                </div>
                <button
                    disabled={busy}
                    onClick={() => onSave({
                        title,
                        description,
                        durationMinutes: Number(duration),
                        languages,
                        leaderboard,
                        proctoring,
                        maxTabSwitches: Number(maxTabSwitches),
                    })}
                    className={`${buttonClass} w-full justify-center bg-white/10 border border-white/15 hover:bg-white/20`}
                >
                    <Save size={16} /> Save settings
                </button>
            </div>
        </div>
    );
}

// ─── Problem + tests ──────────────────────────────────────────────────────────

function ProblemEditor({ contest, problem, judge, busy, act, onError, refresh }: {
    contest: ContestSummary;
    problem: AdminProblem;
    judge: JudgeInfo | null;
    busy: boolean;
    act: (action: () => Promise<unknown>, success?: string) => Promise<void>;
    onError: (message: string) => void;
    refresh: () => Promise<void>;
}) {
    const [title, setTitle] = useState(problem.title);
    const [statement, setStatement] = useState(problem.statement);
    const [points, setPoints] = useState(String(problem.points));
    const [timeLimit, setTimeLimit] = useState(String(problem.timeLimitMs));
    const [memoryLimit, setMemoryLimit] = useState(problem.memoryLimitMb ? String(problem.memoryLimitMb) : '');
    const [preview, setPreview] = useState(false);
    const [sqlSchema, setSqlSchema] = useState(problem.sqlSchema);
    const [sqlSolution, setSqlSolution] = useState(problem.sqlSolution);
    const [orderMatters, setOrderMatters] = useState(problem.sqlOrderMatters);
    const dialog = useDialog();
    const started = contest.phase === 'LIVE' || contest.phase === 'ENDED';
    const isSql = problem.kind === 'SQL';

    const common = { title, statement, points: Number(points), timeLimitMs: Number(timeLimit) };
    const save = () => act(() => contestApi.updateProblem(contest.id, problem.id, {
        ...common,
        ...(isSql
            ? { sqlSchema, sqlSolution, sqlOrderMatters: orderMatters }
            : judge?.backend === 'piston' ? { memoryLimitMb: memoryLimit ? Number(memoryLimit) : null } : {}),
    }), isSql && problem.tests.length > 0 ? 'Problem saved, expected results recomputed' : 'Problem saved');

    // Only before any test exists: tests mean different things for the two types
    const changeKind = (kind: ProblemKind) => kind !== problem.kind && act(() => contestApi.updateProblem(contest.id, problem.id, {
        ...common,
        kind,
        ...(kind === 'SQL' && !problem.sqlSchema ? { sqlSchema: SQL_STARTER_SCHEMA } : {}),
    }), kind === 'SQL' ? 'Now an SQL problem' : 'Now a code problem');
    const kindLocked = problem.tests.length > 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <span className={`${labelClass} mb-0`}>Type</span>
                <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5" title={kindLocked ? 'Delete the tests to change the type' : undefined}>
                    {([['CODE', 'Code', Code2], ['SQL', 'SQL query', Database]] as const).map(([kind, label, Icon]) => (
                        <button
                            key={kind}
                            disabled={busy || (kindLocked && kind !== problem.kind)}
                            onClick={() => changeKind(kind)}
                            aria-pressed={problem.kind === kind}
                            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${problem.kind === kind
                                ? kind === 'SQL' ? 'bg-sky-500/20 text-sky-100' : 'bg-amber-500/20 text-amber-100'
                                : 'text-white/50 hover:text-white'}`}
                        >
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-white/40">
                    {isSql ? 'Participants write one SQLite query; each test is a dataset.' : 'Participants write a program that reads stdin and prints the answer.'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_130px_130px] gap-3">
                <div>
                    <label className={labelClass}>{problem.index} · Title</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Points</label>
                    <input type="number" min={1} value={points} onChange={e => setPoints(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Time limit (ms)</label>
                    <input type="number" min={250} max={isSql ? judge?.sql.maxTimeLimitMs : judge?.maxTimeLimitMs} value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className={inputClass} />
                </div>
                {isSql ? (
                    <div>
                        <label className={labelClass}>Memory</label>
                        <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/20 text-sm text-white/50" title="Every query runs on a fresh in-memory SQLite database">
                            {judge?.sql.memoryLimitMb ?? 32} MB
                        </div>
                    </div>
                ) : (
                    <div>
                        <label className={labelClass} title="Only enforced by Piston">Memory (MB)</label>
                        <input type="number" min={16} value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)} disabled={judge?.backend !== 'piston'} placeholder={judge?.backend === 'piston' ? 'none' : 'Piston only'} className={inputClass} />
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <label className={`${labelClass} mb-0`}>Statement (markdown)</label>
                    <button onClick={() => setPreview(p => !p)} className="text-xs text-amber-200/80 hover:text-amber-100 flex items-center gap-1">
                        {preview ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                    </button>
                </div>
                {preview ? (
                    <div className="min-h-[220px] rounded-lg border border-white/10 bg-black/30 p-4"><Markdown>{statement || '_Nothing written yet._'}</Markdown></div>
                ) : (
                    <textarea
                        value={statement}
                        onChange={e => setStatement(e.target.value)}
                        rows={10}
                        className={`${inputClass} font-mono text-xs leading-relaxed`}
                        placeholder={isSql
                            ? 'Describe the result to return. The schema is shown to participants below the statement.\n\n## Result\nOne row per department with its average salary, columns `department` and `avg_salary`. Ignore employees without a department.'
                            : 'Describe the task, the input format, the output format and the constraints.\n\n## Input\nOne integer n (1 ≤ n ≤ 10^9).\n\n## Output\nPrint 2·n.'}
                    />
                )}
            </div>

            {isSql && (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Schema · shown to participants</label>
                            <textarea
                                value={sqlSchema}
                                onChange={e => setSqlSchema(e.target.value)}
                                rows={9}
                                spellCheck={false}
                                className={`${inputClass} font-mono text-xs leading-relaxed`}
                                placeholder={'CREATE TABLE employees (\n    id INTEGER PRIMARY KEY,\n    name TEXT NOT NULL\n);'}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Reference query · hidden, computes every expected result</label>
                            <textarea
                                value={sqlSolution}
                                onChange={e => setSqlSolution(e.target.value)}
                                rows={9}
                                spellCheck={false}
                                className={`${inputClass} font-mono text-xs leading-relaxed`}
                                placeholder={'SELECT department, AVG(salary) AS avg_salary\nFROM employees\nWHERE department IS NOT NULL\nGROUP BY department;'}
                            />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
                        <input type="checkbox" checked={orderMatters} onChange={e => setOrderMatters(e.target.checked)} className="accent-sky-500 w-4 h-4" />
                        Row order matters <span className="text-white/40 text-xs">(when the statement asks for an ORDER BY)</span>
                    </label>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={save} className={`${buttonClass} bg-amber-500 text-black hover:bg-amber-400`}><Save size={16} /> Save problem</button>
                {started && (
                    <button
                        disabled={busy}
                        onClick={async () => {
                            const ok = await dialog.confirm({
                                title: `Rejudge problem ${problem.index}?`,
                                message: 'Every submission of this problem is judged again with the current tests. Scores and the leaderboard update as the results come in.',
                                confirmLabel: 'Rejudge',
                                icon: <RefreshCw size={26} />,
                            });
                            if (ok) act(() => contestApi.rejudgeProblem(contest.id, problem.id), 'Submissions queued for rejudging');
                        }}
                        className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}
                    >
                        <RefreshCw size={16} /> Rejudge
                    </button>
                )}
                {!started && (
                    <button
                        disabled={busy}
                        onClick={async () => {
                            const ok = await dialog.confirm({
                                title: `Delete problem ${problem.index}?`,
                                message: `"${problem.title}" and all of its test cases are deleted.`,
                                confirmLabel: 'Delete problem',
                                tone: 'danger',
                                icon: <Trash2 size={26} />,
                            });
                            if (ok) act(() => contestApi.deleteProblem(contest.id, problem.id), 'Problem deleted');
                        }}
                        className={`${buttonClass} bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20`}
                    >
                        <Trash2 size={16} /> Delete problem
                    </button>
                )}
            </div>

            <TestsPanel contest={contest} problem={problem} judge={judge} onError={onError} refresh={refresh} />
        </div>
    );
}

function TestsPanel({ contest, problem, judge, onError, refresh }: {
    contest: ContestSummary;
    problem: AdminProblem;
    judge: JudgeInfo | null;
    onError: (message: string) => void;
    refresh: () => Promise<void>;
}) {
    // savedInput: SQL problems keep the editor open after saving to show the computed expected result
    const [editing, setEditing] = useState<{ id: string | null; input: string; expectedOutput: string; isSample: boolean; savedInput?: string } | null>(null);
    const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
    const [sampleCount, setSampleCount] = useState('');
    const [working, setWorking] = useState(false);
    const [uploadNote, setUploadNote] = useState('');
    const filesRef = useRef<HTMLInputElement>(null);
    const folderRef = useRef<HTMLInputElement>(null);
    const dialog = useDialog();
    const toast = useToast();

    const run = async (action: () => Promise<unknown>) => {
        setWorking(true);
        try {
            await action();
            await refresh();
        } catch (err) {
            onError(errorMessage(err));
        } finally {
            setWorking(false);
        }
    };

    const openTest = (test: TestMeta) => run(async () => {
        const full = await contestApi.getTest(contest.id, problem.id, test.id);
        setEditing({ id: full.id, input: full.input, expectedOutput: full.expectedOutput, isSample: full.isSample, savedInput: full.input });
    });

    const isSql = problem.kind === 'SQL';
    const saveTest = () => editing && run(async () => {
        const body = { input: editing.input, expectedOutput: editing.expectedOutput, isSample: editing.isSample };
        const saved = editing.id
            ? await contestApi.updateTest(contest.id, problem.id, editing.id, body)
            : await contestApi.addTest(contest.id, problem.id, body);
        setEditing(isSql ? { id: saved.id, input: saved.input, expectedOutput: saved.expectedOutput, isSample: saved.isSample, savedInput: saved.input } : null);
        toast.success(editing.id ? 'Test saved' : 'Test added', isSql ? 'Expected result computed from the reference query' : undefined);
    });
    const expectedTable = isSql && editing ? parseTable(editing.expectedOutput) : null;
    const expectedStale = !!editing && editing.input !== editing.savedInput;

    const upload = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const files = Array.from(fileList);
        run(async () => {
            const result = await contestApi.uploadTests(contest.id, problem.id, files, uploadMode, sampleCount === '' ? undefined : Number(sampleCount));
            setUploadNote(`Added ${result.added} tests (${result.samples} samples): ${result.names.slice(0, 8).join(', ')}${result.names.length > 8 ? '…' : ''}`);
            toast.success('Tests uploaded', `${result.added} test${result.added === 1 ? '' : 's'} added, ${result.samples} sample${result.samples === 1 ? '' : 's'}`);
        });
        if (filesRef.current) filesRef.current.value = '';
        if (folderRef.current) folderRef.current.value = '';
    };

    const samples = problem.tests.filter(t => t.isSample).length;

    return (
        <div className="border-t border-white/10 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-bold">
                    Test cases <span className="text-white/40 font-normal text-sm">· {problem.tests.length} total, {samples} sample{samples === 1 ? '' : 's'} visible to participants</span>
                </h3>
                <button onClick={() => setEditing({ id: null, input: '', expectedOutput: '', isSample: problem.tests.length === 0 })} className={`${buttonClass} bg-white/10 border border-white/15 hover:bg-white/20`}>
                    <Plus size={16} /> Add test
                </button>
            </div>
            {isSql ? (
                <p className="text-xs text-white/45 mb-4">
                    Each test is a dataset: INSERT statements that run after the schema, on a fresh database. Its expected result comes from your reference query.
                    Each test is worth an equal share of the points. Results are compared by value, {problem.sqlOrderMatters ? 'row by row in order' : 'in any row order'};
                    column names don't matter, numbers match within 0.0001%.
                </p>
            ) : (
                <p className="text-xs text-white/45 mb-4">
                    Each test is worth an equal share of the problem's points. Output is compared line by line, ignoring trailing spaces and trailing blank lines.
                    {judge?.backend === 'wandbox' && problem.tests.length > 20 && <span className="text-amber-300"> Many tests make judging slow on Wandbox.</span>}
                </p>
            )}

            {editing && isSql && (
                <div className="mb-4 rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-4 space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Dataset (INSERT statements)</label>
                            <textarea
                                value={editing.input}
                                onChange={e => setEditing({ ...editing, input: e.target.value })}
                                rows={10}
                                spellCheck={false}
                                className={`${inputClass} font-mono text-xs`}
                                placeholder={"INSERT INTO employees (name, department, salary) VALUES\n    ('Ada', 'eng', 120),\n    ('Grace', 'ops', 90);"}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Expected result · from the reference query</label>
                            {expectedTable && !expectedStale ? (
                                <ResultTable table={expectedTable} maxHeight={232} />
                            ) : (
                                <div className="h-[232px] rounded-lg border border-dashed border-white/15 bg-black/20 flex items-center justify-center text-center text-xs text-white/40 px-6">
                                    {expectedTable ? 'The dataset changed. Save to compute the expected result again.' : 'Save the test to run the reference query on this dataset.'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editing.isSample} onChange={e => setEditing({ ...editing, isSample: e.target.checked })} className="accent-sky-500 w-4 h-4" />
                            Sample (participants see its tables and expected result)
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(null)} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}>{editing.id && !expectedStale ? 'Done' : 'Cancel'}</button>
                            <button disabled={working} onClick={saveTest} className={`${buttonClass} bg-sky-500 text-black hover:bg-sky-400`}><Save size={16} /> {editing.id ? 'Save test' : 'Add test'}</button>
                        </div>
                    </div>
                </div>
            )}

            {editing && !isSql && (
                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Input (stdin)</label>
                            <textarea value={editing.input} onChange={e => setEditing({ ...editing, input: e.target.value })} rows={7} className={`${inputClass} font-mono text-xs`} />
                        </div>
                        <div>
                            <label className={labelClass}>Expected output</label>
                            <textarea value={editing.expectedOutput} onChange={e => setEditing({ ...editing, expectedOutput: e.target.value })} rows={7} className={`${inputClass} font-mono text-xs`} />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input type="checkbox" checked={editing.isSample} onChange={e => setEditing({ ...editing, isSample: e.target.checked })} className="accent-amber-500 w-4 h-4" />
                            Sample (shown to participants with the statement)
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(null)} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}>Cancel</button>
                            <button disabled={working} onClick={saveTest} className={`${buttonClass} bg-amber-500 text-black hover:bg-amber-400`}><Save size={16} /> {editing.id ? 'Save test' : 'Add test'}</button>
                        </div>
                    </div>
                </div>
            )}

            {problem.tests.length > 0 && (
                <div className="rounded-xl border border-white/10 overflow-hidden mb-5">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.04] text-white/40 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="text-left py-2 px-3 w-10">#</th>
                                <th className="text-left py-2 px-3">{isSql ? 'Dataset' : 'Input'}</th>
                                <th className="text-left py-2 px-3">{isSql ? 'Expected result' : 'Expected output'}</th>
                                <th className="text-center py-2 px-3 w-20">Sample</th>
                                <th className="py-2 px-3 w-20" />
                            </tr>
                        </thead>
                        <tbody>
                            {problem.tests.map((t, i) => (
                                <tr key={t.id} className="border-t border-white/5 align-top">
                                    <td className="py-2 px-3 text-white/40">{i + 1}</td>
                                    <td className="py-2 px-3"><pre className="font-mono text-xs text-white/70 whitespace-pre-wrap break-all max-h-16 overflow-hidden">{t.inputPreview}</pre><span className="text-[11px] text-white/30">{formatBytes(t.inputSize)}</span></td>
                                    {isSql ? (
                                        <td className="py-2 px-3 text-xs text-white/60">{t.expectedRows === null ? '—' : `${t.expectedRows} row${t.expectedRows === 1 ? '' : 's'}`}</td>
                                    ) : (
                                        <td className="py-2 px-3"><pre className="font-mono text-xs text-white/70 whitespace-pre-wrap break-all max-h-16 overflow-hidden">{t.outputPreview}</pre><span className="text-[11px] text-white/30">{formatBytes(t.outputSize)}</span></td>
                                    )}
                                    <td className="py-2 px-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={t.isSample}
                                            disabled={working}
                                            onChange={e => run(() => contestApi.updateTest(contest.id, problem.id, t.id, { isSample: e.target.checked }))}
                                            className="accent-amber-500 w-4 h-4"
                                        />
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="flex gap-1 justify-end">
                                            <button onClick={() => openTest(t)} className="p-1.5 rounded hover:bg-white/10 text-white/60" title="Edit"><Pencil size={14} /></button>
                                            <button
                                                onClick={async () => {
                                                    const ok = await dialog.confirm({
                                                        title: `Delete test ${i + 1}?`,
                                                        message: t.isSample ? 'This is a sample test, so participants stop seeing it too.' : undefined,
                                                        confirmLabel: 'Delete test',
                                                        tone: 'danger',
                                                        icon: <Trash2 size={26} />,
                                                    });
                                                    if (ok) {
                                                        run(async () => {
                                                            await contestApi.deleteTest(contest.id, problem.id, t.id);
                                                            toast.success(`Test ${i + 1} deleted`);
                                                        });
                                                    }
                                                }}
                                                className="p-1.5 rounded hover:bg-red-500/15 text-red-300/70"
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4">
                <div className="font-semibold text-sm mb-1 flex items-center gap-2"><FileUp size={16} className="text-amber-300" /> Bulk upload</div>
                {isSql ? (
                    <p className="text-xs text-white/45 mb-3">
                        One <code>.sql</code> file of INSERT statements per test (or a .zip of them). Expected results are computed with your reference query.
                        Files named <code>sample…</code> become samples. Max 100 tests, 1 MB per file.
                    </p>
                ) : (
                    <p className="text-xs text-white/45 mb-3">
                        A .zip or a set of files paired by name: <code>1.in</code> + <code>1.out</code> (or <code>.ans</code>), <code>input/1.txt</code> + <code>output/1.txt</code>,
                        or <code>input01.txt</code> + <code>output01.txt</code>. Files named <code>sample…</code> become samples. Max 100 tests, 1 MB per file.
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <select value={uploadMode} onChange={e => setUploadMode(e.target.value as 'append' | 'replace')} className={`${inputClass} w-auto`}>
                        <option value="append">Add to existing tests</option>
                        <option value="replace">Replace all tests</option>
                    </select>
                    <input type="number" min={0} value={sampleCount} onChange={e => setSampleCount(e.target.value)} placeholder="Samples: auto" className={`${inputClass} w-36`} title="Mark the first N uploaded tests as samples (leave empty to use file names)" />
                    <input ref={filesRef} type="file" multiple accept={isSql ? '.zip,.sql' : '.zip,.in,.out,.ans,.txt,.input,.output,.answer'} className="hidden" onChange={e => upload(e.target.files)} />
                    <input ref={folderRef} type="file" multiple className="hidden" onChange={e => upload(e.target.files)} {...({ webkitdirectory: '' } as Record<string, string>)} />
                    <button disabled={working} onClick={() => filesRef.current?.click()} className={`${buttonClass} bg-white/10 border border-white/15 hover:bg-white/20`}><FileUp size={16} /> Files or .zip</button>
                    <button disabled={working} onClick={() => folderRef.current?.click()} className={`${buttonClass} bg-white/10 border border-white/15 hover:bg-white/20`}><FolderUp size={16} /> Folder</button>
                </div>
                {uploadNote && <div className="text-xs text-emerald-300/90 mt-3">{uploadNote}</div>}
            </div>
        </div>
    );
}
