import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Copy, Users, Code2, Clock, Puzzle, Trash2, ArrowRight } from 'lucide-react';
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
    return result;
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
        localStorage.setItem('collab-username', username.trim());
        navigate(`/room/${joinRoomId.trim()}`);
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
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center py-12 px-6 font-sans relative">
            <div className="absolute top-6 right-6 flex gap-4">
                <BrutalButton variant="secondary" size="sm" onClick={() => navigate('/')}>
                    BACK TO HUB
                </BrutalButton>
                <ThemeToggle />
            </div>

            <div className="w-full max-w-2xl bg-neo-surface border-4 border-neo-border shadow-brutal p-8">
                {/* Header */}
                <div className="flex flex-col items-center mb-8 border-b-4 border-neo-border pb-8">
                    <div className="w-20 h-20 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-4">
                        <Code2 size={40} className="text-neo-border" />
                    </div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter shadow-sm mb-2 text-center">Colab Code Editor</h1>
                    <p className="font-bold text-lg uppercase">Real-time collaborative coding</p>
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

                {error && (
                    <div className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm mb-8">
                        {error}
                    </div>
                )}

                {/* Created Room Card */}
                {createdRoomId && (
                    <div className="bg-neo-accent border-4 border-neo-border p-6 shadow-brutal mb-8 flex flex-col items-center text-center">
                        <div className="flex items-center gap-2 font-black text-xl mb-4">
                            <Users size={24} />
                            <span>ROOM CREATED!</span>
                        </div>
                        <div className="flex items-center justify-center gap-4 bg-neo-surface border-4 border-neo-border p-4 w-full mb-4 shadow-brutal-sm">
                            <code className="text-xl font-bold">{createdRoomId}</code>
                            <BrutalButton size="sm" onClick={handleCopyLink} title="Copy invite link" className="flex-shrink-0">
                                <Copy size={16} />
                                {copied ? 'COPIED!' : 'COPY LINK'}
                            </BrutalButton>
                        </div>
                        <p className="font-bold mb-6">
                            SHARE THIS LINK WITH OTHERS TO COLLABORATE
                        </p>
                        <BrutalButton variant="primary" size="lg" className="w-full text-xl" onClick={handleEnterRoom}>
                            <LogIn size={24} />
                            ENTER ROOM
                        </BrutalButton>
                    </div>
                )}

                {/* Actions */}
                {!createdRoomId && (
                    <div className="flex flex-col gap-8 w-full">
                        {/* Collaboration Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h3 className="font-black text-xl mb-1 uppercase">Create a Session</h3>
                                    <p className="font-semibold text-sm">Start a new collaboration session.</p>
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
                            </div>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <h3 className="font-black text-xl mb-1 uppercase">Join a Room</h3>
                                    <p className="font-semibold text-sm">Enter a room ID from a friend.</p>
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
                            </div>
                        </div>

                        {/* Saved Sessions */}
                        {sessions.length > 0 && !createdRoomId && (
                            <div className="mt-8">
                                <div
                                    className="flex items-center justify-between bg-neo-border text-neo-bg px-4 py-3 cursor-pointer select-none border-4 border-neo-border transition-transform active:translate-y-1"
                                    onClick={() => setShowSessions(!showSessions)}
                                >
                                    <div className="flex items-center gap-3">
                                        <Clock size={20} />
                                        <h3 className="font-black text-lg uppercase tracking-wide">Previous Sessions</h3>
                                    </div>
                                    <div className="bg-neo-bg text-neo-border font-black px-3 py-1 rounded-full text-sm">
                                        {sessions.length}
                                    </div>
                                </div>

                                {showSessions && (
                                    <div className="flex flex-col gap-4 mt-6">
                                        {sessions.map(session => (
                                            <div
                                                key={session.id}
                                                className="bg-neo-surface border-4 border-neo-border p-4 shadow-brutal-sm flex justify-between items-center cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-brutal active:translate-y-0 active:translate-x-0"
                                                onClick={() => handleResumeSession(session)}
                                            >
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-black text-lg">{session.name}</div>
                                                    <div className="flex items-center gap-4 text-sm font-bold opacity-80">
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
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
