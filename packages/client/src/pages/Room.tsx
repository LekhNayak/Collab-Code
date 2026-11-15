import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, LogIn, Copy, Users, Code2, Clock, Puzzle, Trash2, ArrowRight, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, createSession, deleteSession, type SessionInfo } from '../api';
import PageShell from '../components/ui/PageShell';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import Badge from '../components/ui/Badge';
import Pager from '../components/ui/Pager';
import { useToast } from '../contexts/toast';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.05 }
    }
};

const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const } }
};

const SESSIONS_PER_PAGE = 5;

function generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CR-${result}`;
}

export default function RoomPage() {
    const navigate = useNavigate();
    // Set by the Hub's "New room" / "Join room" buttons to focus the matching form
    const intent = (useLocation().state as { intent?: 'create' | 'join' } | null)?.intent;
    const [joinRoomId, setJoinRoomId] = useState('');
    const [username, setUsername] = useState(
        localStorage.getItem('collab-username') || ''
    );
    const [error, setError] = useState('');
    const [createdRoomId, setCreatedRoomId] = useState('');
    const toast = useToast();
    const [copied, setCopied] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [sessionName, setSessionName] = useState('');
    const [showSessions, setShowSessions] = useState(true);
    const [sessionPage, setSessionPage] = useState(0);

    useEffect(() => {
        getSessions().then(setSessions).catch(console.error);
    }, []);

    const handleCreateRoom = async () => {
        if (!username.trim()) {
            setError('Please enter a display name');
            return;
        }
        localStorage.setItem('collab-username', username.trim());
        const roomId = generateRoomId();

        const name = sessionName.trim() || `Session ${new Date().toLocaleDateString()}`;
        try {
            await createSession(name, roomId, roomId, username.trim());
            const updated = await getSessions();
            setSessions(updated);
        } catch (err: any) {
            console.error('Failed to save session:', err);
        }

        setCreatedRoomId(roomId);
        toast.success('Room created', `"${name}" · ${roomId}. Share the link or enter the room.`);
    };

    const handleJoinRoom = () => {
        if (!username.trim()) {
            setError('Please enter a display name');
            return;
        }
        if (!joinRoomId.trim()) {
            setError('Please enter a room ID');
            return;
        }

        let targetId = joinRoomId.trim();

        if (targetId.startsWith('EX-') || targetId.startsWith('e/')) {
            setError('Cannot join an exam from the Collab Hub. Return to the main hub and select "Take an Exam".');
            return;
        }

        if (!targetId.startsWith('CR-')) {
            targetId = `CR-${targetId}`;
        }

        localStorage.setItem('collab-username', username.trim());
        navigate(`/room/${targetId}`);
    };

    const handleEnterRoom = () => {
        navigate(`/room/${createdRoomId}`);
    };

    const handleCopyLink = () => {
        const link = `${window.location.origin}/room/${createdRoomId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleResumeSession = (session: SessionInfo) => {
        if (!username.trim()) {
            setError('Please enter a display name');
            return;
        }
        localStorage.setItem('collab-username', username.trim());
        navigate(`/room/${session.roomId}`);
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const session = sessions.find(s => s.id === id);
        try {
            await deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
            toast.success('Session deleted', session ? `"${session.name}" was removed from your sessions.` : undefined);
        } catch (err: any) {
            console.error('Delete failed:', err);
            toast.error('Could not delete the session', err.message);
        }
    };

    const newestFirst = [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const lastSessionPage = Math.max(0, Math.ceil(newestFirst.length / SESSIONS_PER_PAGE) - 1);
    const currentSessionPage = Math.min(sessionPage, lastSessionPage);
    const pagedSessions = newestFirst.slice(currentSessionPage * SESSIONS_PER_PAGE, (currentSessionPage + 1) * SESSIONS_PER_PAGE);

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <PageShell
            title="Collaboration hub"
            subtitle="Real-time collaborative coding workspace"
            backTo="/"
            backLabel="Hub"
            width="md"
        >
            <AnimatePresence mode="wait" initial={false}>
                {createdRoomId ? (
                    <motion.div
                        key="created"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="ui-card p-6 text-center sm:p-8"
                    >
                        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success-text">
                            <Users size={20} />
                        </div>
                        <h2 className="mb-1 text-lg font-semibold text-fg">Room created</h2>
                        <p className="mb-6 text-sm text-fg-2">Share this code or link with your collaborators.</p>

                        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg bg-canvas p-3 pl-4">
                            <code className="font-mono text-lg font-semibold text-accent-text">{createdRoomId}</code>
                            <Button onClick={handleCopyLink} icon={copied ? <CheckCheck size={15} className="text-success-text" /> : <Copy size={15} />}>
                                {copied ? 'Copied' : 'Copy link'}
                            </Button>
                        </div>

                        <Button variant="primary" size="lg" className="w-full" onClick={handleEnterRoom} icon={<LogIn size={16} />}>
                            Enter room
                        </Button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="actions"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        className="flex flex-col gap-4"
                    >
                        <motion.div variants={staggerItem} className="ui-card p-5">
                            <Field
                                label="Display name"
                                type="text"
                                value={username}
                                onChange={e => { setUsername(e.target.value); setError(''); }}
                                placeholder="Enter your name"
                            />
                        </motion.div>

                        <AnimatePresence initial={false}>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-[13px] text-danger-text">
                                        {error}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <motion.div variants={staggerItem} className="ui-card flex flex-col gap-4 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text">
                                        <Plus size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold leading-tight text-fg">Create session</h3>
                                        <p className="text-[13px] text-fg-3">Start a new room</p>
                                    </div>
                                </div>
                                <Field
                                    type="text"
                                    placeholder="Session name (optional)"
                                    autoFocus={intent === 'create'}
                                    value={sessionName}
                                    onChange={e => setSessionName(e.target.value)}
                                    aria-label="Session name"
                                />
                                <Button variant="primary" onClick={handleCreateRoom} icon={<Plus size={15} />} className="w-full">
                                    Create session
                                </Button>
                            </motion.div>

                            <motion.div variants={staggerItem} className="ui-card flex flex-col gap-4 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-2 text-fg">
                                        <LogIn size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-semibold leading-tight text-fg">Join room</h3>
                                        <p className="text-[13px] text-fg-3">Enter a room ID</p>
                                    </div>
                                </div>
                                <Field
                                    type="text"
                                    placeholder="CR-xxxxxxxx"
                                    autoFocus={intent === 'join'}
                                    value={joinRoomId}
                                    onChange={e => { setJoinRoomId(e.target.value); setError(''); }}
                                    onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                                    className="font-mono"
                                    aria-label="Room ID"
                                />
                                <Button onClick={handleJoinRoom} disabled={!joinRoomId.trim()} icon={<LogIn size={15} />} className="w-full">
                                    Join room
                                </Button>
                            </motion.div>
                        </div>

                        {sessions.length > 0 && (
                            // Mounts after sessions load, when the parent stagger has already run, so it animates itself
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                className="ui-card p-5"
                            >
                                <button
                                    className={`flex w-full items-center justify-between ${showSessions ? 'mb-4' : ''}`}
                                    onClick={() => setShowSessions(!showSessions)}
                                    aria-expanded={showSessions}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Clock size={16} className="text-fg-3" />
                                        <h3 className="text-[15px] font-semibold text-fg">Previous sessions</h3>
                                    </div>
                                    <Badge>{sessions.length}</Badge>
                                </button>

                                <AnimatePresence initial={false}>
                                    {showSessions && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="flex flex-col gap-2 overflow-hidden"
                                        >
                                            {pagedSessions.map((session, index) => (
                                                <motion.div
                                                    key={session.id}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.03, duration: 0.2 }}
                                                    className="group flex cursor-pointer items-center justify-between rounded-lg bg-canvas px-4 py-3 transition-colors hover:bg-tint-2"
                                                    onClick={() => handleResumeSession(session)}
                                                >
                                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                                        <div className="truncate text-sm font-medium text-fg">{session.name}</div>
                                                        <div className="flex items-center gap-4 text-xs text-fg-3">
                                                            <span className="flex items-center gap-1.5"><Clock size={12} /> {formatDate(session.updatedAt)}</span>
                                                            <span className="flex items-center gap-1.5"><Puzzle size={12} /> {session.extensions.length} ext</span>
                                                            <span className="flex items-center gap-1.5"><Code2 size={12} /> {session.openTabs.length} files</span>
                                                        </div>
                                                    </div>
                                                    <div className="ml-3 flex items-center gap-1">
                                                        <button
                                                            onClick={e => handleDeleteSession(session.id, e)}
                                                            className="rounded-md p-2 text-fg-3 transition-colors hover:bg-danger/15 hover:text-danger-text"
                                                            title="Delete session"
                                                            aria-label={`Delete ${session.name}`}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                        <ArrowRight size={15} className="mx-2 text-fg-3 transition-colors group-hover:text-fg" />
                                                    </div>
                                                </motion.div>
                                            ))}
                                            <div className="flex justify-end pt-1">
                                                <Pager page={currentSessionPage} pageSize={SESSIONS_PER_PAGE} total={newestFirst.length} onChange={setSessionPage} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </PageShell>
    );
}
