import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, LogIn, Plus, Settings2, Activity, Users, ListChecks, Trash2 } from 'lucide-react';
import { contestApi, errorMessage, PHASE_LABEL, PHASE_STYLE, type ContestSummary, type ParticipantStatus } from '../contestApi';
import { getTokenUser } from '../auth';
import { useDialog } from '../contexts/dialog';
import { useToast } from '../contexts/toast';
import PageShell from '../components/ui/PageShell';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';

type Owned = ContestSummary & { problemCount: number; participantCount: number };
type Joined = ContestSummary & { organizer: string; status: ParticipantStatus };

const PHASE_BADGE = 'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium';

const formatWhen = (contest: ContestSummary) => {
    if (!contest.startsAt) return `${contest.durationMinutes} min · not scheduled`;
    const start = new Date(contest.startsAt);
    return `${start.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · ${contest.durationMinutes} min`;
};

export default function ContestsHome() {
    const navigate = useNavigate();
    // Set by the Hub's "Join contest" / "Host contest" buttons to focus the matching form
    const intent = (useLocation().state as { intent?: 'create' | 'join' } | null)?.intent;
    const user = getTokenUser();
    const isGuest = !user || user.isGuest;
    const [code, setCode] = useState('');
    const [title, setTitle] = useState('');
    const [owned, setOwned] = useState<Owned[]>([]);
    const [joined, setJoined] = useState<Joined[]>([]);
    const [loading, setLoading] = useState(!isGuest);
    const [error, setError] = useState('');
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const dialog = useDialog();
    const toast = useToast();

    useEffect(() => {
        if (isGuest) return;
        contestApi.mine()
            .then(data => {
                setOwned(data.owned);
                setJoined(data.joined);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [isGuest]);

    const join = (e: React.FormEvent) => {
        e.preventDefault();
        const value = code.trim().toUpperCase();
        if (!value) return;
        navigate(`/c/${value.startsWith('CT-') ? value : `CT-${value}`}`);
    };

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setCreating(true);
        setError('');
        try {
            const contest = await contestApi.create({ title: title.trim() });
            toast.success('Contest created', `"${contest.title}" · ${contest.code}. Add problems and test cases next.`);
            navigate(`/contests/${contest.id}/manage`);
        } catch (err) {
            setError(errorMessage(err));
            setCreating(false);
        }
    };

    // Only drafts and finished contests can be deleted from here; Manage can delete any contest
    const remove = async (contest: Owned) => {
        const hadParticipants = contest.phase === 'ENDED' && contest.participantCount > 0;
        const ok = await dialog.confirm({
            title: `Delete "${contest.title}"?`,
            message: hadParticipants
                ? `Its problems, test cases, submissions, leaderboard and the code of ${contest.participantCount} participant${contest.participantCount === 1 ? '' : 's'} are deleted permanently. It disappears from their history too.`
                : "Its problems and test cases are deleted permanently. This can't be undone.",
            confirmLabel: 'Delete contest',
            tone: 'danger',
            icon: <Trash2 size={20} />,
        });
        if (!ok) return;
        setDeleting(contest.id);
        setError('');
        try {
            await contestApi.remove(contest.id);
            setOwned(list => list.filter(c => c.id !== contest.id));
            toast.success('Contest deleted', `"${contest.title}" was deleted.`);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setDeleting(null);
        }
    };

    const copyCode = (value: string) => {
        navigator.clipboard.writeText(value);
        setCopied(value);
        setTimeout(() => setCopied(''), 1500);
    };

    return (
        <PageShell
            title="Contests"
            subtitle="Competitive coding with automatic judging."
            backTo="/"
            backLabel="Hub"
            width="xl"
        >
            {isGuest && (
                <div className="mb-6 rounded-lg bg-warning/15 px-4 py-3 text-[13px] text-warning-text">
                    Contests need an account so your submissions and score can be saved. Log out and register or sign in to take part.
                </div>
            )}
            {error && <div role="alert" className="mb-6 rounded-lg bg-danger/15 px-4 py-3 text-[13px] text-danger-text">{error}</div>}

            <div className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <form onSubmit={join} className="ui-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold"><LogIn size={16} className="text-fg-3" /> Join a contest</h2>
                    <p className="mb-4 text-[13px] text-fg-2">Enter the code the organizer shared with you.</p>
                    <div className="flex gap-2">
                        <Field
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="CT-XXXXXXXX"
                            aria-label="Contest code"
                            autoFocus={intent === 'join'}
                            className="font-mono"
                        />
                        <Button type="submit" variant="primary" disabled={!code.trim()}>
                            Open <ArrowRight size={15} />
                        </Button>
                    </div>
                </form>

                <form onSubmit={create} className="ui-card p-5">
                    <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold"><Plus size={16} className="text-fg-3" /> Organize a contest</h2>
                    <p className="mb-4 text-[13px] text-fg-2">Create it, add problems and test cases, then schedule or start it.</p>
                    <div className="flex gap-2">
                        <Field
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            disabled={isGuest}
                            placeholder="e.g. Weekly Round #1"
                            aria-label="Contest title"
                            autoFocus={intent === 'create' && !isGuest}
                        />
                        <Button type="submit" disabled={isGuest || !title.trim() || creating} icon={<Plus size={15} />}>
                            {creating ? 'Creating…' : 'Create'}
                        </Button>
                    </div>
                </form>
            </div>

            {!isGuest && (
                <>
                    <h2 className="mb-4 text-[15px] font-semibold">Your contests</h2>
                    {loading ? (
                        <div className="mb-12 h-32 animate-pulse rounded-xl bg-surface" />
                    ) : owned.length === 0 ? (
                        <div className="ui-card mb-12 p-8 text-center text-sm text-fg-2">You haven't created any contests yet.</div>
                    ) : (
                        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {owned.map(c => (
                                <div key={c.id} className="ui-card flex flex-col gap-4 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-[15px] font-semibold leading-snug">{c.title}</h3>
                                        <span className={`${PHASE_BADGE} ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                                    </div>
                                    <div className="text-[13px] text-fg-3">{formatWhen(c)}</div>
                                    <div className="flex items-center gap-4 text-[13px] text-fg-2">
                                        <span className="flex items-center gap-1.5"><ListChecks size={14} /> {c.problemCount} problem{c.problemCount === 1 ? '' : 's'}</span>
                                        <span className="flex items-center gap-1.5"><Users size={14} /> {c.participantCount}</span>
                                    </div>
                                    <button
                                        onClick={() => copyCode(c.code)}
                                        className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2 font-mono text-[13px] text-accent-text transition-colors hover:bg-tint-1"
                                        title="Copy the code to share with participants"
                                    >
                                        {c.code}
                                        <span className="flex items-center gap-1 font-sans text-xs text-fg-3"><Copy size={12} /> {copied === c.code ? 'Copied' : 'Copy'}</span>
                                    </button>
                                    <div className="mt-auto flex gap-2">
                                        <Button className="flex-1" size="sm" icon={<Settings2 size={14} />} onClick={() => navigate(`/contests/${c.id}/manage`)}>
                                            Manage
                                        </Button>
                                        <Button className="flex-1" size="sm" icon={<Activity size={14} />} onClick={() => navigate(`/contests/${c.id}/monitor`)}>
                                            Monitor
                                        </Button>
                                        {(c.phase === 'DRAFT' || c.phase === 'ENDED') && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => remove(c)}
                                                disabled={deleting === c.id}
                                                aria-label={`Delete ${c.title}`}
                                                title={c.phase === 'DRAFT' ? 'Delete this draft' : 'Delete this finished contest'}
                                                className="!px-2.5 hover:!bg-danger/15 hover:!text-danger-text"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <h2 className="mb-4 text-[15px] font-semibold">Joined</h2>
                    {!loading && joined.length === 0 ? (
                        <div className="ui-card mb-12 p-8 text-center text-sm text-fg-2">Contests you join will show up here.</div>
                    ) : (
                        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {joined.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => navigate(`/c/${c.code}`)}
                                    className="ui-card-interactive flex flex-col gap-3 p-5 text-left"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-[15px] font-semibold leading-snug">{c.title}</h3>
                                        <span className={`${PHASE_BADGE} ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                                    </div>
                                    <div className="text-[13px] text-fg-3">{formatWhen(c)}</div>
                                    <div className="text-[13px] text-fg-2">by {c.organizer}{c.status !== 'ACTIVE' && <span className="ml-2 text-danger-text">({c.status.toLowerCase()})</span>}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </PageShell>
    );
}
