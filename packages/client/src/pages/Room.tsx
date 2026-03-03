import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Copy, Users, Code2, Clock, Puzzle, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, createSession, deleteSession, type SessionInfo } from '../api';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
    const [joinRoomId, setJoinRoomId] = useState('');
    const [username, setUsername] = useState(
        localStorage.getItem('collab-username') || ''
    );
    const [error, setError] = useState('');
    const [createdRoomId, setCreatedRoomId] = useState('');
    const [copied, setCopied] = useState(false);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [sessionName, setSessionName] = useState('');
    const [showSessions, setShowSessions] = useState(true);

    // Load saved sessions
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

        // Create a session for this room
        const name = sessionName.trim() || `Session ${new Date().toLocaleDateString()}`;
        try {
            await createSession(name, roomId, roomId, username.trim());
            const updated = await getSessions();
            setSessions(updated);
        } catch (err: any) {
            console.error('Failed to save session:', err);
        }

        setCreatedRoomId(roomId);
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

        // Auto-prepend CR- if they just typed the random code
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
        setTimeout(() => setCopied(false), 2000);
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
        try {
            await deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
        } catch (err: any) {
            console.error('Delete failed:', err);
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
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center py-12 px-6 font-sans relative overflow-hidden">
            {/* Background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute w-28 h-28 border-4 border-neo-border opacity-[0.04]"
                    style={{ top: '8%', right: '12%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 35, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                    className="absolute w-16 h-16 bg-neo-accent opacity-[0.06]"
                    style={{ bottom: '10%', left: '8%' }}
                    animate={{ y: [-10, 10, -10] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="absolute top-6 right-6 flex gap-4 z-20">
                <BrutalButton variant="secondary" size="sm" onClick={() => navigate('/')}>
                    BACK TO HUB
                </BrutalButton>
                <ThemeToggle />
            </div>

            <motion.div
                className="w-full max-w-2xl bg-neo-surface border-4 border-neo-border shadow-brutal p-8 relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
                {/* Header */}
                <div className="flex flex-col items-center mb-8 border-b-4 border-neo-border pb-8">
                    <motion.div
                        className="w-20 h-20 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-4"
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Code2 size={40} className="text-neo-accent-text" />
                    </motion.div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-center text-neo-text">Colab Code Editor</h1>
                    <p className="font-bold text-lg uppercase text-neo-text-secondary">Real-time collaborative coding</p>
                </div>

                {/* Username */}
                <div className="mb-8">
                    <BrutalInput
                        label="DISPLAY NAME"
                        type="text"
                        placeholder="Enter your name..."
                        value={username}
                        onChange={(e) => {
                            setUsername(e.target.value);
                            setError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                    />
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                            className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm overflow-hidden"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Created Room Card */}
                <AnimatePresence>
                    {createdRoomId && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-neo-accent border-4 border-neo-border p-6 shadow-brutal mb-8 flex flex-col items-center text-center"
                        >
                            <div className="flex items-center gap-2 font-black text-xl mb-4 text-neo-accent-text">
                                <Users size={24} />
                                <span>ROOM CREATED!</span>
                            </div>
                            <div className="flex items-center justify-center gap-4 bg-neo-surface border-4 border-neo-border p-4 w-full mb-4 shadow-brutal-sm">
                                <code className="text-xl font-bold text-neo-text">{createdRoomId}</code>
                                <BrutalButton size="sm" onClick={handleCopyLink} title="Copy invite link" className="flex-shrink-0">
                                    <Copy size={16} />
                                    {copied ? 'COPIED!' : 'COPY LINK'}
                                </BrutalButton>
                            </div>
                            <p className="font-bold mb-6 text-neo-accent-text">
                                SHARE THIS LINK WITH OTHERS TO COLLABORATE
                            </p>
                            <BrutalButton variant="primary" size="lg" className="w-full text-xl" onClick={handleEnterRoom}>
                                <LogIn size={24} />
                                ENTER ROOM
                            </BrutalButton>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Actions */}
                {!createdRoomId && (
                    <div className="flex flex-col gap-8 w-full">
                        {/* Collaboration Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <motion.div
                                className="flex flex-col gap-4"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3, duration: 0.4 }}
                            >
                                <div>
                                    <h3 className="font-black text-xl mb-1 uppercase text-neo-text">Create a Session</h3>
                                    <p className="font-semibold text-sm text-neo-text-secondary">Start a new collaboration session.</p>
                                </div>
                                <BrutalInput
                                    type="text"
                                    placeholder="Session name (optional)..."
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                />
                                <BrutalButton variant="primary" onClick={handleCreateRoom} className="mt-auto">
                                    <Plus size={20} />
                                    CREATE SESSION
                                </BrutalButton>
                            </motion.div>

                            <motion.div
                                className="flex flex-col gap-4"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4, duration: 0.4 }}
                            >
                                <div>
                                    <h3 className="font-black text-xl mb-1 uppercase text-neo-text">Join a Room</h3>
                                    <p className="font-semibold text-sm text-neo-text-secondary">Enter a room ID from a friend.</p>
                                </div>
                                <BrutalInput
                                    type="text"
                                    placeholder="Enter room ID..."
                                    value={joinRoomId}
                                    onChange={(e) => {
                                        setJoinRoomId(e.target.value);
                                        setError('');
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                                />
                                <BrutalButton variant="secondary" onClick={handleJoinRoom} disabled={!joinRoomId.trim()} className="mt-auto">
                                    <LogIn size={20} />
                                    JOIN ROOM
                                </BrutalButton>
                            </motion.div>
                        </div>

                        {/* Saved Sessions */}
                        {sessions.length > 0 && !createdRoomId && (
                            <motion.div
                                className="mt-8"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5, duration: 0.4 }}
                            >
                                <motion.div
                                    className="flex items-center justify-between bg-neo-border text-neo-bg px-4 py-3 cursor-pointer select-none border-4 border-neo-border"
                                    onClick={() => setShowSessions(!showSessions)}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <Clock size={20} />
                                        <h3 className="font-black text-lg uppercase tracking-wide">Previous Sessions</h3>
                                    </div>
                                    <motion.div
                                        className="bg-neo-bg text-neo-border font-black px-3 py-1 rounded-full text-sm border-2 border-neo-border"
                                        animate={{ rotate: showSessions ? 0 : 180 }}
                                    >
                                        {sessions.length}
                                    </motion.div>
                                </motion.div>

                                <AnimatePresence>
                                    {showSessions && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="flex flex-col gap-4 mt-6">
                                                {sessions.map((session, index) => (
                                                    <motion.div
                                                        key={session.id}
                                                        className="bg-neo-surface border-4 border-neo-border p-4 shadow-brutal-sm flex justify-between items-center cursor-pointer"
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: index * 0.05, duration: 0.3 }}
                                                        whileHover={{
                                                            x: -4,
                                                            y: -4,
                                                            boxShadow: '8px 8px 0px 0px var(--neo-shadow)',
                                                            transition: { duration: 0.15 }
                                                        }}
                                                        whileTap={{
                                                            x: 2,
                                                            y: 2,
                                                            boxShadow: '0px 0px 0px 0px var(--neo-shadow)',
                                                        }}
                                                        onClick={() => handleResumeSession(session)}
                                                    >
                                                        <div className="flex flex-col gap-1">
                                                            <div className="font-black text-lg text-neo-text">{session.name}</div>
                                                            <div className="flex items-center gap-4 text-sm font-bold text-neo-text-secondary">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock size={14} /> {formatDate(session.updatedAt)}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Puzzle size={14} /> {session.extensions.length} ext
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <Code2 size={14} /> {session.openTabs.length} files
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <BrutalButton
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={(e) => handleDeleteSession(session.id, e)}
                                                                title="Delete session"
                                                                className="px-2 py-2"
                                                            >
                                                                <Trash2 size={18} />
                                                            </BrutalButton>
                                                            <div className="bg-neo-border text-neo-bg p-2 flex items-center justify-center">
                                                                <ArrowRight size={20} />
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
