import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, LogIn, Copy, Users, Code2, Clock, Puzzle, Trash2, ArrowRight, ArrowLeft, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, createSession, deleteSession, type SessionInfo } from '../api';
import LiquidEther from '../components/ui/LiquidEther';
import { useToast } from '../contexts/toast';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
};

const staggerItem = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.34, 1.56, 0.64, 1] as const } }
};

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
        <div className="h-[100dvh] w-full bg-black text-white font-sans relative overflow-hidden">
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            {/* Back button */}
            <div className="absolute top-6 left-6 z-20">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold shadow-sm group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Hub
                </button>
            </div>

            <div className="absolute inset-0 z-10 overflow-x-hidden overflow-y-auto flex flex-col items-center p-4 md:p-6">
            <div className="max-w-3xl w-full relative flex flex-col gap-6 my-auto pt-14 md:pt-6">
                {/* Header */}
                <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.35)] mx-auto mb-4"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                        <Code2 size={32} className="text-white" />
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
                        Collaboration Hub
                    </h1>
                    <p className="font-medium text-white/50 text-base">
                        Real-time collaborative coding workspace
                    </p>
                </motion.div>

                <AnimatePresence mode="wait">
                    {createdRoomId ? (
                        /* ── Room Created Card ── */
                        <motion.div
                            key="created"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl text-center"
                        >
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                <Users size={28} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-white">Room Created!</h2>
                            <p className="text-white/60 mb-6 text-sm font-medium">Share this code or link with your collaborators</p>

                            <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
                                <code className="text-xl font-bold font-mono text-indigo-300 tracking-widest">{createdRoomId}</code>
                                <button
                                    onClick={handleCopyLink}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold transition-all shadow-sm"
                                >
                                    {copied ? <CheckCheck size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    {copied ? 'Copied!' : 'Copy Link'}
                                </button>
                            </div>

                            <button
                                onClick={handleEnterRoom}
                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-lg tracking-wide shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3 transition-all"
                            >
                                <LogIn size={22} /> Enter Room
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="actions"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}
                            className="flex flex-col gap-6"
                        >
                            {/* Username field */}
                            <motion.div variants={staggerItem} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                                <label className="block text-xs font-bold text-white uppercase tracking-widest mb-3 pl-2">Display Name</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => { setUsername(e.target.value); setError(''); }}
                                    placeholder="Enter your name..."
                                    className="w-full bg-black/20 border border-white/5 text-white px-5 py-4 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-base placeholder:text-white/30 shadow-inner"
                                />
                            </motion.div>

                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl px-5 py-4 text-sm font-bold text-center shadow-lg"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Create / Join grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* Create Session */}
                                <motion.div variants={staggerItem} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-md">
                                            <Plus size={24} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-xl leading-tight">Create Session</h3>
                                            <p className="text-white/50 text-sm font-medium">Start a new room</p>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Session name (optional)..."
                                        autoFocus={intent === 'create'}
                                        value={sessionName}
                                        onChange={e => setSessionName(e.target.value)}
                                        className="w-full bg-black/20 border border-white/5 text-white px-5 py-3.5 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium placeholder:text-white/30 shadow-inner"
                                    />
                                    <button
                                        onClick={handleCreateRoom}
                                        className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold tracking-wide shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all mt-1"
                                    >
                                        <Plus size={18} strokeWidth={2.5}/> Create Session
                                    </button>
                                </motion.div>

                                {/* Join Room */}
                                <motion.div variants={staggerItem} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                                            <LogIn size={22} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-xl leading-tight">Join Room</h3>
                                            <p className="text-white/50 text-sm font-medium">Enter a friend's room ID</p>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Enter room ID (CR-...)..."
                                        autoFocus={intent === 'join'}
                                        value={joinRoomId}
                                        onChange={e => { setJoinRoomId(e.target.value); setError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                                        className="w-full bg-black/20 border border-white/5 text-white px-5 py-3.5 rounded-xl outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all text-sm font-medium font-mono uppercase placeholder:text-white/30 placeholder:normal-case shadow-inner"
                                    />
                                    <button
                                        onClick={handleJoinRoom}
                                        disabled={!joinRoomId.trim()}
                                        className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold tracking-wide shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                                    >
                                        <LogIn size={18} strokeWidth={2.5}/> Join Room
                                    </button>
                                </motion.div>
                            </div>

                            {/* Previous Sessions */}
                            {sessions.length > 0 && (
                                // Mounts after sessions load, when the parent stagger has already run, so it animates itself
                                <motion.div
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
                                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 shadow-2xl"
                                >
                                    <button
                                        className={`w-full flex items-center justify-between group ${showSessions ? 'mb-4' : ''}`}
                                        onClick={() => setShowSessions(!showSessions)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Clock size={20} className="text-indigo-300" />
                                            <h3 className="font-bold text-white text-lg">Previous Sessions</h3>
                                        </div>
                                        <span className="text-sm font-bold text-white/80 bg-white/10 px-4 py-1.5 rounded-full shadow-sm border border-white/5">
                                            {sessions.length}
                                        </span>
                                    </button>

                                    <AnimatePresence>
                                        {showSessions && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="overflow-hidden flex flex-col gap-3"
                                            >
                                                {sessions.map((session, index) => (
                                                    <motion.div
                                                        key={session.id}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                                        className="bg-black/30 border border-white/5 rounded-[20px] p-4 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-all group shadow-sm"
                                                        onClick={() => handleResumeSession(session)}
                                                    >
                                                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                            <div className="font-bold text-white truncate text-[15px]">{session.name}</div>
                                                            <div className="flex items-center gap-4 text-[11px] font-semibold text-white/50 uppercase tracking-wide">
                                                                <span className="flex items-center gap-1.5">
                                                                    <Clock size={12} strokeWidth={2.5} /> {formatDate(session.updatedAt)}
                                                                </span>
                                                                <span className="flex items-center gap-1.5">
                                                                    <Puzzle size={12} strokeWidth={2.5} /> {session.extensions.length} ext
                                                                </span>
                                                                <span className="flex items-center gap-1.5">
                                                                    <Code2 size={12} strokeWidth={2.5} /> {session.openTabs.length} files
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 ml-3">
                                                            <button
                                                                onClick={e => handleDeleteSession(session.id, e)}
                                                                className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 border border-white/5 text-white/50 hover:text-red-400 font-bold transition-all shadow-sm"
                                                                title="Delete session"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 group-hover:bg-indigo-500/30 transition-all shadow-md">
                                                                <ArrowRight size={16} strokeWidth={2.5} />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            </div>
        </div>
    );
}
