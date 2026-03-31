import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, RefreshCw, Clock, Code2, Puzzle, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, type SessionInfo } from '../api';

// ─────────────────────────────────────────────────────
// CollabAdmin — Admin view for a collaboration room
// Shows real-time session info by polling the sessions endpoint
// ─────────────────────────────────────────────────────
export default function CollabAdmin() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchSessions = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true);
        try {
            const all = await getSessions();
            // Filter to this specific room
            const forRoom = all.filter(s => s.roomId === roomId);
            setSessions(forRoom);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setLoading(false);
            if (showRefresh) setRefreshing(false);
        }
    }, [roomId]);

    useEffect(() => {
        fetchSessions();
        // Poll every 5 seconds
        const interval = setInterval(() => fetchSessions(), 5000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Active just now';
        if (diff < 3600000) return `Active ${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `Active ${Math.floor(diff / 3600000)}h ago`;
        return `Active ${d.toLocaleDateString()}`;
    };

    const isRecentlyActive = (updatedAt: string) => {
        const diff = new Date().getTime() - new Date(updatedAt).getTime();
        return diff < 300000; // 5 minutes
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#090d1f] via-[#0f172a] to-[#090d1f] text-white p-6 md:p-10 font-sans relative overflow-hidden">
            {/* BG glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/15 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/15 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-4xl mx-auto relative z-10">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-4 mb-8"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 rounded-xl transition-all group"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                            Room Presence
                        </h1>
                        <p className="text-white/50 text-sm mt-1">
                            <code className="font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg">{roomId}</code>
                            {' '}— Collab room user activity
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-white/40">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                        <button
                            onClick={() => fetchSessions(true)}
                            className={`p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all ${refreshing ? 'animate-spin text-indigo-300' : 'text-white/60 hover:text-white'}`}
                            title="Refresh"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </motion.div>

                {/* Stats */}
                <motion.div
                    className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    {[
                        { label: 'Total Sessions', value: sessions.length, icon: <Users size={18} />, color: 'text-indigo-300' },
                        { label: 'Active Now', value: sessions.filter(s => isRecentlyActive(s.updatedAt)).length, icon: <Circle size={18} className="fill-current" />, color: 'text-emerald-300' },
                        { label: 'Open Files', value: sessions.reduce((a, s) => a + s.openTabs.length, 0), icon: <Code2 size={18} />, color: 'text-cyan-300' },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-4 flex items-center gap-3">
                            <div className={stat.color}>{stat.icon}</div>
                            <div>
                                <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                                <div className="text-xs text-white/50">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Enter Room button */}
                <motion.div
                    className="mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <button
                        onClick={() => navigate(`/room/${roomId}`)}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
                    >
                        <Code2 size={20} /> Open Room in IDE
                    </button>
                </motion.div>

                {/* Session list */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                className="h-24 bg-white/5 border border-white/10 rounded-2xl"
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <motion.div
                        className="bg-white/5 border border-dashed border-white/15 rounded-3xl p-16 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Users size={48} className="mx-auto mb-4 text-white/20" />
                        <h3 className="text-xl font-bold text-white/50 mb-2">No sessions found</h3>
                        <p className="text-white/30 text-sm">Sessions appear when users create or join this room.</p>
                    </motion.div>
                ) : (
                    <AnimatePresence>
                        <motion.div
                            className="space-y-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            {sessions.map((session, index) => {
                                const active = isRecentlyActive(session.updatedAt);
                                return (
                                    <motion.div
                                        key={session.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.07, duration: 0.35 }}
                                        className={`bg-white/10 backdrop-blur-xl border rounded-2xl p-5 flex items-start gap-4 transition-all ${
                                            active ? 'border-emerald-500/25 hover:border-emerald-500/40' : 'border-white/15 hover:border-white/25'
                                        }`}
                                    >
                                        {/* Activity indicator */}
                                        <div className="mt-1 flex-shrink-0">
                                            <motion.div
                                                className={`w-3 h-3 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/20'}`}
                                                animate={active ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] } : {}}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-4 mb-2">
                                                <div>
                                                    <h3 className="font-bold text-white text-lg leading-tight">{session.name}</h3>
                                                    <p className="text-white/50 text-sm">
                                                        Owner: <span className="text-indigo-300 font-medium">{session.owner}</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {active && (
                                                        <span className="text-xs bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-full font-bold">
                                                            Active
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-white/40 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                                                        {formatDate(session.updatedAt)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-white/50 flex-wrap">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock size={12} />
                                                    Created {new Date(session.createdAt).toLocaleDateString()}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Code2 size={12} />
                                                    {session.openTabs.length} open files
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Puzzle size={12} />
                                                    {session.extensions.length} extensions
                                                </span>
                                            </div>

                                            {/* Open tabs */}
                                            {session.openTabs.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {session.openTabs.slice(0, 6).map(tab => (
                                                        <span
                                                            key={tab}
                                                            className="text-xs font-mono bg-black/30 border border-white/10 text-white/60 px-2 py-0.5 rounded-lg"
                                                        >
                                                            {tab.split('/').pop()}
                                                        </span>
                                                    ))}
                                                    {session.openTabs.length > 6 && (
                                                        <span className="text-xs text-white/40 px-2 py-0.5">
                                                            +{session.openTabs.length - 6} more
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
