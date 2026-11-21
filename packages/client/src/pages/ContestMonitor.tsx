import ThemeToggle from '../components/ThemeToggle';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft, Ban, CheckCircle, Clock, Eye, Loader2, Maximize2, Play, Plus, RefreshCw, Settings2, Square, Trophy, UserX, Users, X, Send, Activity,
} from 'lucide-react';
import Leaderboard from '../components/contest/Leaderboard';
import VerdictBadge from '../components/contest/VerdictBadge';
import Countdown from '../components/contest/Countdown';
import LiveCodePreview from '../components/LiveCodePreview';
import Overlay from '../components/ui/Overlay';
import { useDialogPanel } from '../components/ui/useDialog';
import Pager from '../components/ui/Pager';
import IconTile from '../components/ui/IconTile';
import Button from '../components/ui/Button';
import {
    contestApi, errorMessage, formatScore, PHASE_LABEL, PHASE_STYLE, VERDICT_STYLE,
    type MonitorData, type SubmissionDetail,
} from '../contestApi';
import { useDialog } from '../contexts/dialog';
import { useToast } from '../contexts/toast';
import { languageLabel } from '../contest/languages';

// Any number of participants can be watched; two code windows show at a time and the rest are on pages
const MAX_WATCH = 12;
const WATCH_PAGE = 2;
const WALL_LAYOUTS = [1, 2, 4, 6] as const;
type WallLayout = typeof WALL_LAYOUTS[number];
const WALL_GRID: Record<WallLayout, string> = {
    1: 'grid-cols-1 grid-rows-1',
    2: 'grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1',
    4: 'grid-cols-1 lg:grid-cols-2 lg:grid-rows-2',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2',
};

const buttonClass = 'h-8 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40';
const cardClass = 'ui-card';
// Below xl the page scrolls as one column; from xl up each card is a fixed pane that scrolls inside itself,
// so the page itself never scrolls and nothing falls below the fold.
const paneClass = `${cardClass} flex min-h-0 flex-col p-5 xl:flex-1 xl:basis-0`;
const paneBody = 'min-h-0 max-h-80 flex-1 overflow-auto xl:max-h-none';

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
    TAB_SWITCH: 'text-accent-text',
    FULLSCREEN_EXIT: 'text-accent-text',
    PASTE: 'text-danger-text',
    BLOCK: 'text-danger-text',
    REMOVE: 'text-danger-text',
    JOIN: 'text-success-text',
};

export default function ContestMonitor() {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<MonitorData | null>(null);
    const [clockOffset, setClockOffset] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [pinned, setPinned] = useState<string[]>([]);
    const [watchPage, setWatchPage] = useState(0);
    const [wallOpen, setWallOpen] = useState(false);
    const [openSubmission, setOpenSubmission] = useState<SubmissionDetail | null>(null);
    const dialog = useDialog();
    const toast = useToast();

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

    const act = async (action: () => Promise<unknown>, success?: string, detail?: string) => {
        setBusy(true);
        setError('');
        try {
            await action();
            if (success) toast.success(success, detail);
            await load();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const togglePin = (userId: string) => setPinned(list => (
        list.includes(userId) ? list.filter(u => u !== userId) : [...list, userId].slice(-MAX_WATCH)
    ));

    const showSubmission = (submissionId: string) =>
        contestApi.submission(id, submissionId).then(setOpenSubmission).catch(err => setError(errorMessage(err)));

    if (!data) {
        return (
            <div role="status" className="h-[100dvh] bg-canvas text-fg flex items-center justify-center">
                {error ? <div className="text-danger-text">{error}</div> : <Loader2 className="animate-spin text-fg-3" size={32} />}
            </div>
        );
    }

    const { contest, problems, participants, leaderboard, events, submissions, judge } = data;
    const usernameOf = (userId: string) => participants.find(p => p.userId === userId)?.username ?? 'participant';
    const problemIndex = (problemId: string) => problems.find(p => p.id === problemId)?.index ?? '?';
    const accepted = submissions.filter(s => s.verdict === 'AC').length;
    const blocked = participants.filter(p => p.status === 'BLOCKED').length;

    const lastWatchPage = Math.max(0, Math.ceil(pinned.length / WATCH_PAGE) - 1);
    const currentWatchPage = Math.min(watchPage, lastWatchPage);
    const watching = pinned.slice(currentWatchPage * WATCH_PAGE, (currentWatchPage + 1) * WATCH_PAGE);

    return (
        <div className="h-[100dvh] w-full overflow-y-auto bg-canvas text-fg xl:overflow-hidden">
            <main id="main-content" tabIndex={-1} className="mx-auto max-w-[110rem] px-5 py-5 focus:outline-none md:px-8 xl:flex xl:h-full xl:flex-col">
                {/* Header */}
                <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={() => navigate('/contests')} className="p-2.5 rounded-lg bg-tint-2 hover:bg-tint-3" aria-label="All contests"><ArrowLeft size={18} /></button>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text"><Activity size={20} /></div>
                        <div className="min-w-0">
                            <h1 className="text-2xl font-semibold truncate">{contest.title} <span className="text-fg-3 font-semibold text-lg">· Live monitor</span></h1>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3 mt-0.5">
                                <span className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${PHASE_STYLE[contest.phase]}`}>{PHASE_LABEL[contest.phase]}</span>
                                <span className="font-mono text-accent-text">{contest.code}</span>
                                {contest.phase === 'LIVE' && <span className="flex items-center gap-1"><Clock size={14} /> <Countdown target={contest.endsAt} offsetMs={clockOffset} className="text-success-text font-semibold" /> left</span>}
                                {contest.phase === 'SCHEDULED' && <span className="flex items-center gap-1"><Clock size={14} /> starts in <Countdown target={contest.startsAt} offsetMs={clockOffset} className="text-accent-text font-semibold" /></span>}
                                <span>· judge: {judge.backend}{judge.queued > 0 ? `, ${judge.queued} queued` : ''}{judge.backlog > 0 ? `, ${judge.backlog} runs waiting for Wandbox` : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ThemeToggle />
                        <button onClick={() => setWallOpen(true)} className={`${buttonClass} bg-tint-2 hover:bg-tint-3`} title="Watch several participants' code side by side"><Maximize2 size={15} /> Code wall</button>
                        <button onClick={() => navigate(`/contests/${contest.id}/manage`)} className={`${buttonClass} bg-tint-2 hover:bg-tint-3`}><Settings2 size={16} /> Manage</button>
                        <button onClick={() => act(load)} disabled={busy} className={`${buttonClass} bg-tint-2 hover:bg-tint-3`} title="Refresh now" aria-label="Refresh now"><RefreshCw size={16} /></button>
                        {(contest.phase === 'DRAFT' || contest.phase === 'SCHEDULED') && (
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
                                    if (ok) act(() => contestApi.start(contest.id), 'Contest started', `Participants can see the problems for the next ${contest.durationMinutes} minutes.`);
                                }}
                                className={`${buttonClass} bg-success-solid text-white hover:bg-success`}><Play size={16} /> Start now</button>
                        )}
                        {contest.phase === 'LIVE' && (
                            <>
                                <button disabled={busy} onClick={() => act(() => contestApi.update(contest.id, { durationMinutes: contest.durationMinutes + 15 }), 'Extended by 15 minutes')} className={`${buttonClass} bg-tint-2 hover:bg-tint-3`}><Plus size={16} /> 15 min</button>
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
                                        if (ok) act(() => contestApi.end(contest.id), 'Contest ended', 'Submissions are closed; queued ones are still judged.');
                                    }}
                                    className={`${buttonClass} bg-danger-solid text-white hover:bg-danger`}><Square size={16} /> End now</button>
                            </>
                        )}
                    </div>
                </div>

                {error && <div role="alert" className="mb-4 flex shrink-0 justify-between rounded-lg bg-danger/10 px-4 py-3 text-danger-text">{error}<button onClick={() => setError('')} aria-label="Dismiss error" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-tint-3"><X size={16} /></button></div>}

                {/* Stats */}
                <div className="mb-4 grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4">
                    {[
                        { label: 'Participants', value: participants.length, icon: <Users size={18} />, color: 'text-accent-text' },
                        { label: 'Submissions', value: submissions.length >= 100 ? '100+' : submissions.length, icon: <Send size={18} />, color: 'text-accent-text' },
                        { label: 'Accepted', value: accepted, icon: <CheckCircle size={18} />, color: 'text-success-text' },
                        { label: 'Blocked', value: blocked, icon: <Ban size={18} />, color: 'text-danger-text' },
                    ].map(stat => (
                        <div key={stat.label} className={`${cardClass} flex items-center gap-4 px-5 py-3`}>
                            <div className={stat.color}>{stat.icon}</div>
                            <div>
                                <div className="text-xl font-semibold leading-tight tabular-nums">{stat.value}</div>
                                <div className="text-xs text-fg-3">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_460px]">
                    {/* Left: leaderboard, the code being watched, participants */}
                    <div className="flex min-h-0 min-w-0 flex-col gap-4">
                        <div className={paneClass}>
                            <div className="mb-3 flex shrink-0 items-center justify-between">
                                <h2 className="flex items-center gap-2 text-base font-semibold"><Trophy size={17} className="text-fg-3" /> Leaderboard</h2>
                                <span className="text-xs text-fg-3">Click a row to watch that participant's code live</span>
                            </div>
                            <div className={paneBody}>
                                <Leaderboard rows={leaderboard} problems={problems} startsAt={contest.startsAt} onSelect={row => togglePin(row.userId)} selectedUserIds={pinned} />
                            </div>
                        </div>

                        {pinned.length > 0 && (
                            <div className={`${cardClass} flex min-h-0 flex-col p-4 xl:flex-[1.7] xl:basis-0`}>
                                <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
                                    <h2 className="flex items-center gap-2 text-base font-semibold">
                                        <Eye size={17} className="text-fg-3" /> Watching
                                        <span className="inline-flex h-5 items-center rounded-full bg-tint-2 px-2 text-[11px] font-medium text-fg-2">{pinned.length}</span>
                                    </h2>
                                    <div className="flex items-center gap-1">
                                        <Pager page={currentWatchPage} pageSize={WATCH_PAGE} total={pinned.length} onChange={setWatchPage} />
                                        <button onClick={() => setWallOpen(true)} className={`${buttonClass} !h-7 bg-tint-2 hover:bg-tint-3`}><Maximize2 size={13} /> Code wall</button>
                                        <button onClick={() => setPinned([])} className={`${buttonClass} !h-7 text-fg-2 hover:bg-tint-2 hover:text-fg`}>Clear</button>
                                    </div>
                                </div>
                                {/* Inline previews step aside while the wall is open, so no code is streamed twice */}
                                {!wallOpen && (
                                    <motion.div
                                        key={currentWatchPage}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.25, ease: [0.25, 0.8, 0.25, 1] }}
                                        className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 lg:grid-cols-2"
                                    >
                                        {watching.map(userId => (
                                            <PreviewCard key={userId} contestId={contest.id} userId={userId} username={usernameOf(userId)} onClose={() => togglePin(userId)} className="h-[300px] xl:h-auto" />
                                        ))}
                                    </motion.div>
                                )}
                            </div>
                        )}

                        <div className={paneClass}>
                            <h2 className="mb-3 shrink-0 text-base font-semibold">Participants</h2>
                            {participants.length === 0 ? <div className="text-fg-3 text-sm py-6 text-center">Nobody has joined yet. Share the code <span className="font-mono text-accent-text">{contest.code}</span>.</div> : (
                                <div className={paneBody}>
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-[1] bg-surface">
                                            <tr className="text-fg-3 text-xs border-b border-line">
                                                <th className="text-left py-2 px-2">Name</th>
                                                <th className="text-left py-2 px-2">Status</th>
                                                <th className="text-left py-2 px-2">Tab switches</th>
                                                <th className="text-left py-2 px-2">Joined</th>
                                                <th className="py-2 px-2"><span className="sr-only">Actions</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {participants.map(p => (
                                                <tr key={p.userId} className="border-b border-line-faint">
                                                    <td className="py-2 px-2 font-medium">{p.username}</td>
                                                    <td className="py-2 px-2">
                                                        <span className={p.status === 'ACTIVE' ? 'text-success-text' : p.status === 'BLOCKED' ? 'text-danger-text' : 'text-fg-3'}>{p.status.toLowerCase()}</span>
                                                        {p.blockedReason && p.status !== 'ACTIVE' && <span className="text-fg-3 text-xs ml-2">{p.blockedReason}</span>}
                                                    </td>
                                                    <td className={`py-2 px-2 tabular-nums ${contest.proctoring && p.tabSwitchCount >= contest.maxTabSwitches ? 'text-danger-text font-semibold' : 'text-fg-2'}`}>
                                                        {p.tabSwitchCount}{contest.proctoring ? `/${contest.maxTabSwitches}` : ''}
                                                    </td>
                                                    <td className="py-2 px-2 text-fg-3">{new Date(p.joinedAt).toLocaleTimeString()}</td>
                                                    <td className="py-2 px-2">
                                                        <div className="flex gap-1.5 justify-end">
                                                            <button
                                                                onClick={() => togglePin(p.userId)}
                                                                className={`p-1.5 rounded transition-colors ${pinned.includes(p.userId) ? 'bg-accent/15 text-accent-text' : 'text-fg-2 hover:bg-tint-3'}`}
                                                                title={pinned.includes(p.userId) ? 'Stop watching' : 'Watch code'}
                                                                aria-label={pinned.includes(p.userId) ? `Stop watching ${p.username}` : `Watch ${p.username}'s code`}
                                                            ><Eye size={15} /></button>
                                                            {p.status === 'ACTIVE' && (
                                                                <button disabled={busy} onClick={() => act(() => contestApi.participantAction(contest.id, p.userId, 'block'), 'Participant blocked', p.username)} className="px-2 py-1 rounded bg-danger/15 text-danger-text text-xs font-semibold hover:bg-danger/25 flex items-center gap-1"><Ban size={12} /> Block</button>
                                                            )}
                                                            {p.status === 'BLOCKED' && (
                                                                <button disabled={busy} onClick={() => act(() => contestApi.participantAction(contest.id, p.userId, 'unblock'), 'Participant unblocked', p.username)} className="px-2 py-1 rounded bg-success/15 text-success-text text-xs font-semibold hover:bg-success/25 flex items-center gap-1"><CheckCircle size={12} /> Unblock</button>
                                                            )}
                                                            {p.status !== 'REMOVED' && (
                                                                <button
                                                                    disabled={busy}
                                                                    onClick={async () => {
                                                                        const ok = await dialog.confirm({
                                                                            title: `Remove ${p.username}?`,
                                                                            message: 'They are taken out of the contest and disappear from the leaderboard.',
                                                                            confirmLabel: 'Remove',
                                                                            tone: 'danger',
                                                                            icon: <UserX size={26} />,
                                                                        });
                                                                        if (ok) act(() => contestApi.participantAction(contest.id, p.userId, 'remove'), 'Participant removed', p.username);
                                                                    }}
                                                                    className="px-2 py-1 rounded bg-tint-1 text-fg-2 text-xs font-semibold hover:bg-accent/20 hover:text-accent-text flex items-center gap-1"
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

                    {/* Right: submissions and activity, each scrolling inside its own pane */}
                    <div className="flex min-h-0 min-w-0 flex-col gap-4">
                        <div className={paneClass}>
                            <h2 className="mb-3 shrink-0 text-base font-semibold">Submissions</h2>
                            {submissions.length === 0 ? <div className="text-fg-3 text-sm py-6 text-center">No submissions yet.</div> : (
                                <div className={`${paneBody} -mx-1`}>
                                    {submissions.slice(0, 60).map(s => (
                                        <button key={s.id} onClick={() => showSubmission(s.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-tint-1 text-left text-sm">
                                            <span className="text-fg-3 tabular-nums w-20 shrink-0">{new Date(s.createdAt).toLocaleTimeString()}</span>
                                            <span className="font-medium truncate flex-1">{s.username}</span>
                                            <span className="font-semibold text-fg-2 w-6 text-center">{problemIndex(s.problemId)}</span>
                                            <span className="w-16 shrink-0">{s.verdict ? <VerdictBadge verdict={s.verdict} short /> : <span className="text-xs text-accent-text">{s.status.toLowerCase()}</span>}</span>
                                            <span className="tabular-nums text-fg-2 w-12 text-right">{formatScore(s.score)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className={paneClass}>
                            <h2 className="mb-3 shrink-0 text-base font-semibold">Activity</h2>
                            {events.length === 0 ? <div className="text-fg-3 text-sm py-6 text-center">Nothing yet.</div> : (
                                <div className={`${paneBody} space-y-1.5 text-sm`}>
                                    {events.map(e => (
                                        <div key={e.id} className="flex gap-3">
                                            <span className="text-fg-3 tabular-nums w-20 shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</span>
                                            <span className={EVENT_STYLE[e.type] ?? 'text-fg-2'}>
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
            </main>

            {/* A full page over the monitor: several codespaces together */}
            <AnimatePresence>
                {wallOpen && (
                    <CodeWall
                        contestId={contest.id}
                        title={contest.title}
                        participants={participants}
                        pinned={pinned}
                        onToggle={togglePin}
                        onWatchAll={() => setPinned(participants.filter(p => p.status !== 'REMOVED').map(p => p.userId).slice(0, MAX_WATCH))}
                        onClear={() => setPinned([])}
                        onClose={() => setWallOpen(false)}
                    />
                )}
            </AnimatePresence>

            {openSubmission && (
                <Overlay
                    label={`Submission by ${openSubmission.user.username}, problem ${openSubmission.problem.index}`}
                    onClose={() => setOpenSubmission(null)}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    panelClassName="w-full max-w-4xl max-h-[90vh] bg-raised shadow-float rounded-xl p-6 overflow-y-auto"
                >
                    <div>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-xl font-semibold">{openSubmission.user.username} · {openSubmission.problem.index}. {openSubmission.problem.title}</h2>
                                <div className="text-sm text-fg-3 mt-1 flex flex-wrap items-center gap-2">
                                    {new Date(openSubmission.createdAt).toLocaleString()} · {languageLabel(contest.languages, openSubmission.language)}
                                    {openSubmission.verdict && <VerdictBadge verdict={openSubmission.verdict} />}
                                    <span>{openSubmission.passed}/{openSubmission.total} tests · {formatScore(openSubmission.score)} points</span>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {(openSubmission.status === 'DONE' || openSubmission.status === 'ERROR') && (
                                    <button
                                        disabled={busy}
                                        onClick={() => act(async () => { await contestApi.rejudgeSubmission(contest.id, openSubmission.id); setOpenSubmission(null); }, 'Submission queued for rejudging')}
                                        className={`${buttonClass} bg-tint-2 hover:bg-tint-3`}
                                    >
                                        <RefreshCw size={15} /> Rejudge
                                    </button>
                                )}
                                <button onClick={() => setOpenSubmission(null)} className="p-2 rounded-lg hover:bg-tint-3" aria-label="Close"><X size={18} /></button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {openSubmission.results.map((r, i) => (
                                <span key={i} className={`px-2 py-1 rounded-md text-xs font-medium ${VERDICT_STYLE[r.verdict]}`} title={`${r.timeMs ?? '-'} ms`}>#{i + 1} {r.verdict}</span>
                            ))}
                        </div>
                        {openSubmission.compileOutput && (
                            <pre className="mb-4 rounded-lg  bg-danger/10 p-3 font-mono text-xs text-danger-text whitespace-pre-wrap max-h-48 overflow-auto">{openSubmission.compileOutput}</pre>
                        )}
                        <pre tabIndex={0} aria-label="Submitted code" className="rounded-lg border border-line bg-canvas p-4 font-mono text-xs text-fg whitespace-pre overflow-auto max-h-[55vh]">{openSubmission.code}</pre>
                    </div>
                </Overlay>
            )}
        </div>
    );
}

// ─── Code wall ────────────────────────────────────────────────────────────────

function CodeWall({ contestId, title, participants, pinned, onToggle, onWatchAll, onClear, onClose }: {
    contestId: string;
    title: string;
    participants: MonitorData['participants'];
    pinned: string[];
    onToggle: (userId: string) => void;
    onWatchAll: () => void;
    onClear: () => void;
    onClose: () => void;
}) {
    const [perPage, setPerPage] = useState<WallLayout>(4);
    const [page, setPage] = useState(0);
    const usernameOf = (userId: string) => participants.find(p => p.userId === userId)?.username ?? 'participant';

    const lastPage = Math.max(0, Math.ceil(pinned.length / perPage) - 1);
    const current = Math.min(page, lastPage);
    const visible = pinned.slice(current * perPage, (current + 1) * perPage);
    const candidates = participants.filter(p => p.status !== 'REMOVED');

    const wall = useDialogPanel<HTMLDivElement>('Code wall', onClose);

    // The arrow keys turn the wall's pages (unless a field has the keys); Esc is the dialog's own
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement | null)?.closest('.monaco-editor, input, textarea, select')) return;
            if (e.key === 'ArrowRight') setPage(p => Math.min(lastPage, p + 1));
            if (e.key === 'ArrowLeft') setPage(p => Math.max(0, p - 1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lastPage]);

    return (
        <motion.div
            {...wall.props}
            className="fixed inset-0 z-40 flex flex-col bg-canvas focus:outline-none"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.32, ease: [0.25, 0.8, 0.25, 1] }}
        >
            <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
                <button onClick={onClose} className="rounded-lg bg-tint-2 p-2 text-fg-2 transition-colors hover:bg-tint-3 hover:text-fg" aria-label="Back to the monitor" title="Back to the monitor (Esc)"><ArrowLeft size={17} /></button>
                <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold leading-tight">Code wall</h2>
                    <div className="truncate text-xs text-fg-3">{title} · {pinned.length} watched</div>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-xs text-fg-3">
                    Per page
                    <div className="inline-flex rounded-lg bg-tint-2 p-0.5" role="group" aria-label="Windows per page">
                        {WALL_LAYOUTS.map(n => (
                            <button
                                key={n}
                                onClick={() => { setPerPage(n); setPage(0); }}
                                aria-pressed={perPage === n}
                                className={`h-7 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors ${perPage === n ? 'bg-surface text-fg shadow-card' : 'text-fg-2 hover:text-fg'}`}
                            >{n}</button>
                        ))}
                    </div>
                </div>
                <Pager page={current} pageSize={perPage} total={pinned.length} onChange={setPage} />
                <ThemeToggle />
            </header>

            {/* Who is on the wall: one chip each, click to add or remove */}
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-line px-4 py-2.5 sm:px-6">
                {candidates.map(p => {
                    const on = pinned.includes(p.userId);
                    return (
                        <button
                            key={p.userId}
                            onClick={() => onToggle(p.userId)}
                            aria-pressed={on}
                            className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${on ? 'bg-accent/15 text-accent-text' : 'bg-tint-1 text-fg-2 hover:bg-tint-2 hover:text-fg'}`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'BLOCKED' ? 'bg-danger' : p.status === 'ACTIVE' ? 'bg-success' : 'bg-tint-5'}`} />
                            {p.username}
                        </button>
                    );
                })}
                <div className="ml-auto flex shrink-0 items-center gap-1 pl-3">
                    <button onClick={onWatchAll} className="h-7 rounded-md px-2 text-xs font-medium text-fg-2 transition-colors hover:bg-tint-2 hover:text-fg">Watch all</button>
                    <button onClick={onClear} disabled={pinned.length === 0} className="h-7 rounded-md px-2 text-xs font-medium text-fg-2 transition-colors hover:bg-tint-2 hover:text-fg disabled:opacity-40">Clear</button>
                </div>
            </div>

            <div className="min-h-0 flex-1 p-4 sm:p-5">
                {pinned.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                        <IconTile size={48}><Eye size={22} /></IconTile>
                        <div>
                            <h3 className="mb-1 text-base font-semibold">Nobody on the wall yet</h3>
                            <p className="text-sm text-fg-2">Pick participants above to watch their code side by side.</p>
                        </div>
                        {candidates.length > 0 && <Button variant="primary" onClick={onWatchAll}>Watch everyone ({Math.min(candidates.length, MAX_WATCH)})</Button>}
                    </div>
                ) : (
                    <motion.div
                        key={`${current}:${perPage}`}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, ease: [0.25, 0.8, 0.25, 1] }}
                        className={`grid h-full gap-3 overflow-y-auto ${WALL_GRID[perPage]}`}
                    >
                        {visible.map(userId => (
                            <PreviewCard key={userId} contestId={contestId} userId={userId} username={usernameOf(userId)} onClose={() => onToggle(userId)} className="min-h-[240px]" />
                        ))}
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

function PreviewCard({ contestId, userId, username, onClose, className = '' }: { contestId: string; userId: string; username: string; onClose: () => void; className?: string }) {
    const [connected, setConnected] = useState(false);
    const [file, setFile] = useState<string | null>(null);
    return (
        <div className={`${cardClass} flex min-h-0 flex-col overflow-hidden ${className}`}>
            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 shrink-0 rounded-full ${connected ? 'bg-success' : 'bg-tint-5'}`} />
                    <span className="font-semibold truncate">{username}</span>
                    <span className="text-xs text-fg-3 font-mono truncate">{file ?? 'no file open'}</span>
                </div>
                <button onClick={onClose} className="p-1 rounded hover:bg-tint-3 text-fg-3" aria-label={`Stop watching ${username}`}><X size={15} /></button>
            </div>
            <div className="relative min-h-0 flex-1 bg-canvas">
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
