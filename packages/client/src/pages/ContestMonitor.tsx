import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Ban, CheckCircle, Clock, Eye, Loader2, Play, Plus, RefreshCw, Settings2, Square, Trophy, UserX, Users, X, Send, Activity,
} from 'lucide-react';
import Leaderboard from '../components/contest/Leaderboard';
import VerdictBadge from '../components/contest/VerdictBadge';
import Countdown from '../components/contest/Countdown';
import LiveCodePreview from '../components/LiveCodePreview';
import {
    contestApi, errorMessage, formatScore, PHASE_LABEL, PHASE_STYLE, VERDICT_STYLE,
    type MonitorData, type SubmissionDetail,
} from '../contestApi';

const MAX_PREVIEWS = 4;
const buttonClass = 'px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40';
const cardClass = 'bg-white/[0.04] border border-white/10 rounded-2xl';

const EVENT_LABEL: Record<string, string> = {
    JOIN: 'joined',
    TAB_SWITCH: 'switched tabs',
    FULLSCREEN_EXIT: 'left fullscreen',
    PASTE: 'pasted text',
    BLOCK: 'was blocked',
    UNBLOCK: 'was unblocked',
    REMOVE: 'was removed',
    START: 'started the contest',
    END: 'ended the contest',
};

const EVENT_STYLE: Record<string, string> = {
    TAB_SWITCH: 'text-orange-300',
    FULLSCREEN_EXIT: 'text-orange-300',
    PASTE: 'text-red-300',
    BLOCK: 'text-red-300',
    REMOVE: 'text-red-300',
    JOIN: 'text-emerald-300',
};

export default function ContestMonitor() {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<MonitorData | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [pinned, setPinned] = useState<string[]>([]);
    const [openSubmission, setOpenSubmission] = useState<SubmissionDetail | null>(null);

    const load = useCallback(async () => {
        try {
            const next = await contestApi.monitor(id);
            setData(next);
            setClockOffset(new Date(next.serverNow).getTime() - Date.now());
        } catch (err) {
            setError(errorMessage(err));
        }
    }, [id]);

    useEffect(() => {
        load();
        const timer = setInterval(load, 5000);
        return () => clearInterval(timer);
    }, [load]);

    const act = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError('');
        try {
            await action();
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const togglePin = (userId: string) => setPinned(list => (
        list.includes(userId) ? list.filter(u => u !== userId) : [...list, userId].slice(-MAX_PREVIEWS)
    ));

    const showSubmission = (submissionId: string) =>
        contestApi.submission(id, submissionId).then(setOpenSubmission).catch(err => setError(errorMessage(err)));

    if (!data) {
        return (
            <div className="h-[100dvh] bg-[#0a0a0c] text-white flex items-center justify-center">
                {error ? <div className="text-red-300">{error}</div> : <Loader2 className="animate-spin text-white/40" size={32} />}
            </div>
        );
    }

    const { contest, problems, participants, leaderboard, events, submissions, judge } = data;
    const usernameOf = (userId: string) => participants.find(p => p.userId === userId)?.username ?? 'participant';
    const problemIndex = (problemId: string) => problems.find(p => p.id === problemId)?.index ?? '?';
    const accepted = submissions.filter(s => s.verdict === 'AC').length;
    const blocked = participants.filter(p => p.status === 'BLOCKED').length;

    return (
        <div className="h-[100dvh] w-full bg-[#0a0a0c] text-white overflow-y-auto">
            <div className="max-w-[110rem] mx-auto px-5 md:px-8 py-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={() => navigate('/contests')} className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"><ArrowLeft size={18} /></button>
                        <div className="w-11 h-11 bg-[#f59e0b]/90 rounded-xl flex items-center justify-center shrink-0"><Activity size={22} /></div>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-extrabold truncate">{contest.title} <span className="text-white/40 font-semibold text-lg">· Live monitor</span></h1>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-white/50 mt-0.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${PHASE_STYLE[contest.phase]}`}>{PHASE_LABEL[contest.phase]}</span>
                                <span className="font-mono text-amber-200">{contest.code}</span>
                                {contest.phase === 'LIVE' && <span className="flex items-center gap-1"><Clock size={14} /> <Countdown target={contest.endsAt} offsetMs={clockOffset} className="text-emerald-300 font-semibold" /> left</span>}
                                {contest.phase === 'SCHEDULED' && <span className="flex items-center gap-1"><Clock size={14} /> starts in <Countdown target={contest.startsAt} offsetMs={clockOffset} className="text-sky-300 font-semibold" /></span>}
                                <span>· judge: {judge.backend}{judge.queued > 0 ? `, ${judge.queued} queued` : ''}{judge.backlog > 0 ? `, ${judge.backlog} runs waiting for Wandbox` : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => navigate(`/contests/${contest.id}/manage`)} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}><Settings2 size={16} /> Manage</button>
                        <button onClick={() => act(load)} disabled={busy} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`} title="Refresh now"><RefreshCw size={16} /></button>
                        {(contest.phase === 'DRAFT' || contest.phase === 'SCHEDULED') && (
                            <button disabled={busy} onClick={() => window.confirm('Start the contest now?') && act(() => contestApi.start(contest.id))} className={`${buttonClass} bg-emerald-500 text-black hover:bg-emerald-400`}><Play size={16} /> Start now</button>
                        )}
                        {contest.phase === 'LIVE' && (
                            <>
                                <button disabled={busy} onClick={() => act(() => contestApi.update(contest.id, { durationMinutes: contest.durationMinutes + 15 }))} className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}><Plus size={16} /> 15 min</button>
                                <button disabled={busy} onClick={() => window.confirm('End the contest now?') && act(() => contestApi.end(contest.id))} className={`${buttonClass} bg-red-500/80 hover:bg-red-500`}><Square size={16} /> End now</button>
                            </>
                        )}
                    </div>
                </div>

                {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex justify-between">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'Participants', value: participants.length, icon: <Users size={18} />, color: 'text-sky-300' },
                        { label: 'Submissions', value: submissions.length >= 100 ? '100+' : submissions.length, icon: <Send size={18} />, color: 'text-amber-300' },
                        { label: 'Accepted', value: accepted, icon: <CheckCircle size={18} />, color: 'text-emerald-300' },
                        { label: 'Blocked', value: blocked, icon: <Ban size={18} />, color: 'text-red-300' },
                    ].map(stat => (
                        <div key={stat.label} className={`${cardClass} px-5 py-4 flex items-center gap-4`}>
                            <div className={stat.color}>{stat.icon}</div>
                            <div>
                                <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
                                <div className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 2xl:grid-cols-[1fr_520px] gap-6">
                    <div className="space-y-6 min-w-0">
                        <div className={`${cardClass} p-5`}>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-lg font-bold flex items-center gap-2"><Trophy size={18} className="text-amber-400" /> Leaderboard</h2>
                                <span className="text-xs text-white/40">Click a row to watch that participant's code live</span>
                            </div>
                            <Leaderboard rows={leaderboard} problems={problems} startsAt={contest.startsAt} onSelect={row => togglePin(row.userId)} selectedUserIds={pinned} />
                        </div>

                        {pinned.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {pinned.map(userId => (
                                    <PreviewCard key={userId} contestId={contest.id} userId={userId} username={usernameOf(userId)} onClose={() => togglePin(userId)} />
                                ))}
                            </div>
                        )}

                        <div className={`${cardClass} p-5`}>
                            <h2 className="text-lg font-bold mb-3">Participants</h2>
                            {participants.length === 0 ? <div className="text-white/40 text-sm py-6 text-center">Nobody has joined yet. Share the code <span className="font-mono text-amber-200">{contest.code}</span>.</div> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
                                                <th className="text-left py-2 px-2">Name</th>
                                                <th className="text-left py-2 px-2">Status</th>
                                                <th className="text-left py-2 px-2">Tab switches</th>
                                                <th className="text-left py-2 px-2">Joined</th>
                                                <th className="py-2 px-2" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {participants.map(p => (
                                                <tr key={p.userId} className="border-b border-white/5">
                                                    <td className="py-2 px-2 font-medium">{p.username}</td>
                                                    <td className="py-2 px-2">
                                                        <span className={p.status === 'ACTIVE' ? 'text-emerald-300' : p.status === 'BLOCKED' ? 'text-red-300' : 'text-white/40'}>{p.status.toLowerCase()}</span>
                                                        {p.blockedReason && p.status !== 'ACTIVE' && <span className="text-white/40 text-xs ml-2">{p.blockedReason}</span>}
                                                    </td>
                                                    <td className={`py-2 px-2 tabular-nums ${contest.proctoring && p.tabSwitchCount >= contest.maxTabSwitches ? 'text-red-300 font-bold' : 'text-white/60'}`}>
                                                        {p.tabSwitchCount}{contest.proctoring ? `/${contest.maxTabSwitches}` : ''}
                                                    </td>
                                                    <td className="py-2 px-2 text-white/50">{new Date(p.joinedAt).toLocaleTimeString()}</td>
                                                    <td className="py-2 px-2">
                                                        <div className="flex gap-1.5 justify-end">
                                                            <button onClick={() => togglePin(p.userId)} className="p-1.5 rounded hover:bg-white/10 text-white/60" title="Watch code"><Eye size={15} /></button>
                                                            {p.status === 'ACTIVE' && (
                                                                <button disabled={busy} onClick={() => act(() => contestApi.participantAction(contest.id, p.userId, 'block'))} className="px-2 py-1 rounded bg-red-500/15 text-red-300 text-xs font-bold hover:bg-red-500/25 flex items-center gap-1"><Ban size={12} /> Block</button>
                                                            )}
                                                            {p.status === 'BLOCKED' && (
                                                                <button disabled={busy} onClick={() => act(() => contestApi.participantAction(contest.id, p.userId, 'unblock'))} className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 flex items-center gap-1"><CheckCircle size={12} /> Unblock</button>
                                                            )}
                                                            {p.status !== 'REMOVED' && (
                                                                <button
                                                                    disabled={busy}
                                                                    onClick={() => window.confirm(`Remove ${p.username} from the contest? They disappear from the leaderboard.`) && act(() => contestApi.participantAction(contest.id, p.userId, 'remove'))}
                                                                    className="px-2 py-1 rounded bg-white/5 text-white/60 text-xs font-bold hover:bg-orange-500/20 hover:text-orange-300 flex items-center gap-1"
                                                                >
                                                                    <UserX size={12} /> Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6 min-w-0">
                        <div className={`${cardClass} p-5`}>
                            <h2 className="text-lg font-bold mb-3">Submissions</h2>
                            {submissions.length === 0 ? <div className="text-white/40 text-sm py-6 text-center">No submissions yet.</div> : (
                                <div className="max-h-[420px] overflow-y-auto -mx-1">
                                    {submissions.slice(0, 60).map(s => (
                                        <button key={s.id} onClick={() => showSubmission(s.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left text-sm">
                                            <span className="text-white/40 tabular-nums w-20 shrink-0">{new Date(s.createdAt).toLocaleTimeString()}</span>
                                            <span className="font-medium truncate flex-1">{s.username}</span>
                                            <span className="font-bold text-white/70 w-6 text-center">{problemIndex(s.problemId)}</span>
                                            <span className="w-16 shrink-0">{s.verdict ? <VerdictBadge verdict={s.verdict} short /> : <span className="text-xs text-sky-300">{s.status.toLowerCase()}</span>}</span>
                                            <span className="tabular-nums text-white/70 w-12 text-right">{formatScore(s.score)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={`${cardClass} p-5`}>
                            <h2 className="text-lg font-bold mb-3">Activity</h2>
                            {events.length === 0 ? <div className="text-white/40 text-sm py-6 text-center">Nothing yet.</div> : (
                                <div className="max-h-[360px] overflow-y-auto space-y-1.5 text-sm">
                                    {events.map(e => (
                                        <div key={e.id} className="flex gap-3">
                                            <span className="text-white/35 tabular-nums w-20 shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                            <span className={EVENT_STYLE[e.type] ?? 'text-white/70'}>
                                                <span className="font-semibold">{e.username ?? 'Organizer'}</span> {EVENT_LABEL[e.type] ?? e.type.toLowerCase()}
                                                {e.type === 'TAB_SWITCH' && e.details?.count !== undefined ? ` (${String(e.details.count)})` : ''}
                                                {e.type === 'PASTE' && e.details?.length !== undefined ? ` (${String(e.details.length)} chars)` : ''}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {openSubmission && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setOpenSubmission(null)}>
                    <div className="w-full max-w-4xl max-h-[90vh] bg-[#111114] border border-white/10 rounded-2xl p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold">{openSubmission.user.username} · {openSubmission.problem.index}. {openSubmission.problem.title}</h2>
                                <div className="text-sm text-white/50 mt-1 flex flex-wrap items-center gap-2">
                                    {new Date(openSubmission.createdAt).toLocaleString()} · {openSubmission.language}
                                    {openSubmission.verdict && <VerdictBadge verdict={openSubmission.verdict} />}
                                    <span>{openSubmission.passed}/{openSubmission.total} tests · {formatScore(openSubmission.score)} points</span>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {(openSubmission.status === 'DONE' || openSubmission.status === 'ERROR') && (
                                    <button
                                        disabled={busy}
                                        onClick={() => act(async () => { await contestApi.rejudgeSubmission(contest.id, openSubmission.id); setOpenSubmission(null); })}
                                        className={`${buttonClass} bg-white/5 border border-white/10 hover:bg-white/10`}
                                    >
                                        <RefreshCw size={15} /> Rejudge
                                    </button>
                                )}
                                <button onClick={() => setOpenSubmission(null)} className="p-2 rounded-lg hover:bg-white/10"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {openSubmission.results.map((r, i) => (
                                <span key={i} className={`px-2 py-1 rounded-md border text-xs font-bold ${VERDICT_STYLE[r.verdict]}`} title={`${r.timeMs ?? '-'} ms`}>#{i + 1} {r.verdict}</span>
                            ))}
                        </div>
                        {openSubmission.compileOutput && (
                            <pre className="mb-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3 font-mono text-xs text-red-200 whitespace-pre-wrap max-h-48 overflow-auto">{openSubmission.compileOutput}</pre>
                        )}
                        <pre className="rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/85 whitespace-pre overflow-auto max-h-[55vh]">{openSubmission.code}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}

function PreviewCard({ contestId, userId, username, onClose }: { contestId: string; userId: string; username: string; onClose: () => void }) {
    const [connected, setConnected] = useState(false);
    const [file, setFile] = useState<string | null>(null);
    return (
        <div className={`${cardClass} overflow-hidden flex flex-col h-[320px] ${connected ? 'border-emerald-500/25' : ''}`}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                    <span className="font-semibold truncate">{username}</span>
                    <span className="text-xs text-white/40 font-mono truncate">{file ?? 'no file open'}</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-white/50"><X size={15} /></button>
            </div>
            <div className="flex-1 bg-black/40">
                <LiveCodePreview
                    roomName={`contest-monitor-${userId}`}
                    params={{ mode: 'contest-monitor', contestId, participantId: userId }}
                    followUserId={userId}
                    onConnectedChange={setConnected}
                    onViewingFileChange={setFile}
                />
            </div>
        </div>
    );
}
