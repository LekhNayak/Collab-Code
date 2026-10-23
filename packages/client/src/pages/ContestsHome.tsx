import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Copy, LogIn, Plus, Settings2, Trophy, Activity, Users, ListChecks } from 'lucide-react';
import LiquidEther from '../components/ui/LiquidEther';
import { contestApi, errorMessage, PHASE_LABEL, PHASE_STYLE, type ContestSummary, type ParticipantStatus } from '../contestApi';
import { getTokenUser } from '../auth';

type Owned = ContestSummary & { problemCount: number; participantCount: number };
type Joined = ContestSummary & { organizer: string; status: ParticipantStatus };

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
            navigate(`/contests/${contest.id}/manage`);
        } catch (err) {
            setError(errorMessage(err));
            setCreating(false);
        }
    };

    const copyCode = (value: string) => {
        navigator.clipboard.writeText(value);
        setCopied(value);
        setTimeout(() => setCopied(''), 1500);
    };

    return (
        <div className="h-[100dvh] w-full bg-black text-white font-sans relative overflow-hidden">
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            <div className="absolute top-6 left-6 z-20">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold shadow-sm group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Hub
                </button>
            </div>

            <div className="absolute inset-0 z-10 overflow-x-hidden overflow-y-auto p-6 md:p-12 pt-24">
                <div className="max-w-6xl mx-auto w-full">
                    <motion.div
                        className="flex items-center gap-5 mb-10 border-b border-white/10 pb-6"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="w-16 h-16 bg-[#f59e0b]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.45)]">
                            <Trophy size={32} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight">Contests</h1>
                            <p className="text-amber-100/60 text-lg font-medium">Competitive coding with automatic judging</p>
                        </div>
                    </motion.div>

                    {isGuest && (
                        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-amber-100">
                            Contests need an account so your submissions and score can be saved. Log out and register or sign in to take part.
                        </div>
                    )}
                    {error && <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">{error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                        <form onSubmit={join} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl">
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><LogIn size={20} className="text-amber-300" /> Join a contest</h2>
                            <p className="text-white/50 text-sm mb-5">Enter the code the organizer shared with you.</p>
                            <div className="flex gap-3">
                                <input
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                    placeholder="CT-XXXXXXXX"
                                    autoFocus={intent === 'join'}
                                    className="flex-1 bg-black/30 border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 font-mono tracking-wider uppercase"
                                />
                                <button
                                    type="submit"
                                    disabled={!code.trim()}
                                    className="px-6 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold flex items-center gap-2 transition-colors"
                                >
                                    Open <ArrowRight size={18} />
                                </button>
                            </div>
                        </form>

                        <form onSubmit={create} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl">
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><Plus size={20} className="text-amber-300" /> Organize a contest</h2>
                            <p className="text-white/50 text-sm mb-5">Create it, add problems and test cases, then schedule or start it.</p>
                            <div className="flex gap-3">
                                <input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    disabled={isGuest}
                                    placeholder="e.g. Weekly Round #1"
                                    autoFocus={intent === 'create' && !isGuest}
                                    className="flex-1 bg-black/30 border border-white/10 px-4 py-3 rounded-xl outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-40"
                                />
                                <button
                                    type="submit"
                                    disabled={isGuest || !title.trim() || creating}
                                    className="px-6 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 disabled:opacity-40 font-bold flex items-center gap-2 transition-colors"
                                >
                                    <Plus size={18} /> {creating ? 'Creating…' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {!isGuest && (
                        <>
                            <h2 className="text-2xl font-bold mb-5 flex items-center gap-3"><div className="w-2 h-7 bg-amber-500 rounded-full" /> Your contests</h2>
                            {loading ? (
                                <div className="h-32 rounded-2xl bg-white/5 border border-white/10 animate-pulse mb-12" />
                            ) : owned.length === 0 ? (
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-white/50 mb-12">You haven't created any contests yet.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                                    {owned.map(c => (
                                        <div key={c.id} className="bg-white/[0.07] backdrop-blur-md border border-white/15 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="font-bold text-lg leading-snug">{c.title}</h3>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                                            </div>
                                            <div className="text-sm text-white/50">{formatWhen(c)}</div>
                                            <div className="flex items-center gap-4 text-sm text-white/60">
                                                <span className="flex items-center gap-1.5"><ListChecks size={15} /> {c.problemCount} problem{c.problemCount === 1 ? '' : 's'}</span>
                                                <span className="flex items-center gap-1.5"><Users size={15} /> {c.participantCount}</span>
                                            </div>
                                            <button
                                                onClick={() => copyCode(c.code)}
                                                className="flex items-center justify-between bg-black/30 border border-white/10 rounded-lg px-3 py-2 font-mono text-amber-200 text-sm hover:border-amber-500/30"
                                                title="Copy the code to share with participants"
                                            >
                                                {c.code} <span className="text-xs text-white/50 flex items-center gap-1"><Copy size={13} /> {copied === c.code ? 'Copied' : 'Copy'}</span>
                                            </button>
                                            <div className="flex gap-2 mt-auto">
                                                <button onClick={() => navigate(`/contests/${c.id}/manage`)} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-semibold flex items-center justify-center gap-1.5">
                                                    <Settings2 size={15} /> Manage
                                                </button>
                                                <button onClick={() => navigate(`/contests/${c.id}/monitor`)} className="flex-1 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-sm font-semibold flex items-center justify-center gap-1.5">
                                                    <Activity size={15} /> Monitor
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <h2 className="text-2xl font-bold mb-5 flex items-center gap-3"><div className="w-2 h-7 bg-sky-500 rounded-full" /> Joined</h2>
                            {!loading && joined.length === 0 ? (
                                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-white/50 mb-12">Contests you join will show up here.</div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                                    {joined.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => navigate(`/c/${c.code}`)}
                                            className="text-left bg-white/[0.07] backdrop-blur-md border border-white/15 rounded-2xl p-5 flex flex-col gap-3 shadow-xl hover:bg-white/10 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="font-bold text-lg leading-snug">{c.title}</h3>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 ${PHASE_STYLE[c.phase]}`}>{PHASE_LABEL[c.phase]}</span>
                                            </div>
                                            <div className="text-sm text-white/50">{formatWhen(c)}</div>
                                            <div className="text-sm text-white/60">by {c.organizer}{c.status !== 'ACTIVE' && <span className="text-red-300 ml-2">({c.status.toLowerCase()})</span>}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
