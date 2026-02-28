import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Copy, Users, Code2, Clock, Puzzle, Trash2, ArrowRight } from 'lucide-react';
import { getSessions, createSession, deleteSession, type SessionInfo } from '../api';

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
        <div className="room-page">
            <div className="room-container">
                {/* Header */}
                <div className="room-header">
                    <Code2 size={40} className="room-logo" />
                    <h1>Colab Code Editor</h1>
                    <p className="room-subtitle">Real-time collaborative coding</p>
                </div>

                {/* Username */}
                <div className="room-section">
                    <label className="room-label">Display Name</label>
                    <input
                        className="room-input"
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

                {error && <div className="room-error">{error}</div>}

                {/* Created Room Card */}
                {createdRoomId && (
                    <div className="room-created-card">
                        <div className="room-created-header">
                            <Users size={18} />
                            <span>Room Created!</span>
                        </div>
                        <div className="room-id-display">
                            <code>{createdRoomId}</code>
                            <button
                                className="room-copy-btn"
                                onClick={handleCopyLink}
                                title="Copy invite link"
                            >
                                <Copy size={14} />
                                {copied ? 'Copied!' : 'Copy Link'}
                            </button>
                        </div>
                        <p className="room-share-hint">
                            Share this link with others to collaborate
                        </p>
                        <button className="room-btn room-btn-primary" onClick={handleEnterRoom}>
                            <LogIn size={16} />
                            Enter Room
                        </button>
                    </div>
                )}

                {/* Actions */}
                {!createdRoomId && (
                    <div className="flex flex-col gap-8 w-full">
                        {/* Collaboration Section */}
                        <div className="room-actions">
                            <div className="room-action-card">
                                <h3>Create a Session</h3>
                                <p>Start a new collaboration session</p>
                                <input
                                    className="room-input"
                                    type="text"
                                    placeholder="Session name (optional)..."
                                    value={sessionName}
                                    onChange={(e) => setSessionName(e.target.value)}
                                />
                                <button className="room-btn room-btn-primary" onClick={handleCreateRoom}>
                                    <Plus size={16} />
                                    Create Session
                                </button>
                            </div>

                            <div className="room-divider">
                                <span>or</span>
                            </div>

                            <div className="room-action-card">
                                <h3>Join a Room</h3>
                                <p>Enter a room ID to join</p>
                                <input
                                    className="room-input"
                                    type="text"
                                    placeholder="Enter room ID..."
                                    value={joinRoomId}
                                    onChange={(e) => {
                                        setJoinRoomId(e.target.value);
                                        setError('');
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                                />
                                <button
                                    className="room-btn room-btn-secondary"
                                    onClick={handleJoinRoom}
                                    disabled={!joinRoomId.trim()}
                                >
                                    <LogIn size={16} />
                                    Join Room
                                </button>
                            </div>
                        </div>

                        {/* Saved Sessions */}
                        {sessions.length > 0 && !createdRoomId && (
                            <div className="session-history">
                                <div
                                    className="session-history-header"
                                    onClick={() => setShowSessions(!showSessions)}
                                >
                                    <Clock size={16} />
                                    <h3>Previous Sessions</h3>
                                    <span className="session-count">{sessions.length}</span>
                                </div>

                                {showSessions && (
                                    <div className="session-list">
                                        {sessions.map(session => (
                                            <div
                                                key={session.id}
                                                className="session-card"
                                                onClick={() => handleResumeSession(session)}
                                            >
                                                <div className="session-card-main">
                                                    <div className="session-card-name">{session.name}</div>
                                                    <div className="session-card-meta">
                                                        <span className="session-meta-item">
                                                            <Clock size={11} /> {formatDate(session.updatedAt)}
                                                        </span>
                                                        <span className="session-meta-item">
                                                            <Puzzle size={11} /> {session.extensions.length} ext
                                                        </span>
                                                        <span className="session-meta-item">
                                                            <Code2 size={11} /> {session.openTabs.length} files
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="session-card-actions">
                                                    <button
                                                        className="session-delete-btn"
                                                        onClick={(e) => handleDeleteSession(session.id, e)}
                                                        title="Delete session"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                    <ArrowRight size={16} className="session-arrow" />
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
