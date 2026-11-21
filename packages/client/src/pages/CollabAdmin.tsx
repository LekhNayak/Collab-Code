import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, RefreshCw, Clock, Code2, Puzzle, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSessions, type SessionInfo } from '../api';
import PageShell from '../components/ui/PageShell';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import IconTile from '../components/ui/IconTile';

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

    const stats = [
        { label: 'Total sessions', value: sessions.length, icon: <Users size={16} /> },
        { label: 'Active now', value: sessions.filter(s => isRecentlyActive(s.updatedAt)).length, icon: <Circle size={14} className="fill-current" /> },
        { label: 'Open files', value: sessions.reduce((a, s) => a + s.openTabs.length, 0), icon: <Code2 size={16} /> },
    ];

    return (
        <PageShell
            title="Room presence"
            subtitle={<><code className="rounded-md bg-accent/15 px-1.5 py-0.5 font-mono text-[13px] text-accent-text">{roomId}</code>{' '}· Collab room user activity</>}
            backTo={-1}
            width="lg"
            actions={
                <>
                    <span className="hidden text-xs text-fg-3 sm:inline">Updated {lastUpdated.toLocaleTimeString()}</span>
                    <Button
                        size="sm"
                        onClick={() => fetchSessions(true)}
                        icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
                    >
                        Refresh
                    </Button>
                </>
            }
        >
            <div className="mb-6 grid grid-cols-3 gap-3">
                {stats.map(stat => (
                    <div key={stat.label} className="ui-card flex items-center gap-3 p-4">
                        <div className="text-fg-3">{stat.icon}</div>
                        <div>
                            <div className="text-2xl font-semibold leading-none text-fg">{stat.value}</div>
                            <div className="mt-1.5 text-xs text-fg-3">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <Button variant="primary" size="lg" className="mb-8 w-full" icon={<Code2 size={16} />} onClick={() => navigate(`/room/${roomId}`)}>
                Open room in IDE
            </Button>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <motion.div
                            key={i}
                            className="h-24 rounded-xl bg-surface"
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                        />
                    ))}
                </div>
            ) : sessions.length === 0 ? (
                <div className="ui-card flex flex-col items-center gap-4 px-6 py-14 text-center">
                    <IconTile size={48}><Users size={22} /></IconTile>
                    <div>
                        <h2 className="mb-1 text-base font-semibold text-fg">No sessions found</h2>
                        <p className="text-sm text-fg-2">Sessions appear when users create or join this room.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session, index) => {
                        const active = isRecentlyActive(session.updatedAt);
                        return (
                            <motion.div
                                key={session.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.04, duration: 0.25 }}
                                className="ui-card flex items-start gap-4 p-5"
                            >
                                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${active ? 'bg-success' : 'bg-tint-5'}`} />

                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <h2 className="truncate text-[15px] font-semibold leading-tight text-fg">{session.name}</h2>
                                            <p className="mt-0.5 text-[13px] text-fg-3">
                                                Owner: <span className="font-medium text-fg-2">{session.owner}</span>
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {active && <Badge tone="success" dot>Active</Badge>}
                                            <Badge>{formatDate(session.updatedAt)}</Badge>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-xs text-fg-3">
                                        <span className="flex items-center gap-1.5"><Clock size={12} /> Created {new Date(session.createdAt).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1.5"><Code2 size={12} /> {session.openTabs.length} open files</span>
                                        <span className="flex items-center gap-1.5"><Puzzle size={12} /> {session.extensions.length} extensions</span>
                                    </div>

                                    {session.openTabs.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {session.openTabs.slice(0, 6).map(tab => (
                                                <span key={tab} className="rounded-md bg-canvas px-2 py-0.5 font-mono text-xs text-fg-2">
                                                    {tab.split('/').pop()}
                                                </span>
                                            ))}
                                            {session.openTabs.length > 6 && (
                                                <span className="px-2 py-0.5 text-xs text-fg-3">+{session.openTabs.length - 6} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </PageShell>
    );
}
