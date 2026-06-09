import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamLogs, getExamSessions, blockStudent, unblockStudent, removeStudent } from '../api';
import type { ExamLog } from '../api';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import {
    ShieldAlert, Terminal, ArrowLeft, Filter, UserPlus, MonitorOff,
    AppWindow, Ban, CheckCircle, UserX, Users, RefreshCw, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─────────────────────────────────────────────────────
// StudentPreview — live read-only code mirror per student
// ─────────────────────────────────────────────────────
const StudentPreview = ({
    examId, studentId, studentName, session, onBlock, onUnblock, onRemove
}: {
    examId: string;
    studentId: string;
    studentName: string;
    session: any;
    onBlock: (id: string) => void;
    onUnblock: (id: string) => void;
    onRemove: (id: string) => void;
}) => {
    const [connected, setConnected] = useState(false);
    const editorRef = useRef<any>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const docRef = useRef<Y.Doc | null>(null);

    useEffect(() => {
        return () => {
            providerRef.current?.destroy();
            docRef.current?.destroy();
        };
    }, []);

    const handleMount = (editor: any) => {
        editorRef.current = editor;
        const doc = new Y.Doc();
        docRef.current = doc;

        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
        const token = localStorage.getItem('token') || '';

        const wsProvider = new WebsocketProvider(wsUrl, `admin-monitor-${studentId}`, doc, {
            params: { token, examId, studentId, mode: 'admin-monitor' }
        });
        providerRef.current = wsProvider;

        wsProvider.on('status', (event: { status: string }) => {
            setConnected(event.status === 'connected');
        });

        const type = doc.getText('monaco');
        new MonacoBinding(type, editor.getModel(), new Set([editor]), wsProvider.awareness);

        editor.updateOptions({ readOnly: true });
    };

    const isRemoved = session?.status === 'REMOVED';

    return (
        <motion.div
            className={`bg-white/10 backdrop-blur-md border rounded-2xl shadow-2xl flex flex-col h-[360px] overflow-hidden transition-all ${
                isRemoved ? 'border-gray-500/40 opacity-60' :
                session?.isBlocked ? 'border-red-500/40' :
                connected ? 'border-emerald-500/30' :
                'border-white/20 hover:border-white/30'
            }`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
            {/* Card Header */}
            <div className={`px-4 py-3 border-b flex justify-between items-center ${
                isRemoved ? 'bg-gray-500/10 border-gray-500/20' :
                session?.isBlocked ? 'bg-red-500/15 border-red-500/20' :
                connected ? 'bg-emerald-500/10 border-emerald-500/20' :
                'bg-white/5 border-white/10'
            }`}>
                <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-white text-base flex items-center gap-2">
                        {studentName}
                        {isRemoved && <span className="text-xs uppercase bg-gray-500/50 text-white/70 px-2 py-0.5 rounded-full font-bold">Removed</span>}
                        {session?.isBlocked && !isRemoved && <span className="text-xs uppercase bg-red-500/80 text-white px-2 py-0.5 rounded-full font-bold shadow">Blocked</span>}
                        {connected && !session?.isBlocked && !isRemoved && <span className="text-xs uppercase bg-emerald-500/80 text-white px-2 py-0.5 rounded-full font-bold shadow">Live</span>}
                    </span>
                    <span className="text-xs text-white/60">
                        Tab switches: <span className={session?.tabSwitchCount >= 3 ? 'text-red-400 font-bold' : 'text-white/80'}>{session?.tabSwitchCount || 0}</span>/3
                    </span>
                </div>
                <div className="flex gap-2 items-center">
                    {!isRemoved && (
                        session?.isBlocked ? (
                            <button
                                onClick={() => onUnblock(studentId)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1"
                            >
                                <CheckCircle size={14} /> Unblock
                            </button>
                        ) : (
                            <button
                                onClick={() => onBlock(studentId)}
                                className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow flex items-center gap-1"
                            >
                                <Ban size={14} /> Block
                            </button>
                        )
                    )}
                    {!isRemoved && (
                        <button
                            onClick={() => onRemove(studentId)}
                            className="bg-white/10 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/30 text-white/60 hover:text-orange-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            title="Remove student from exam"
                        >
                            <UserX size={14} /> Remove
                        </button>
                    )}
                    <motion.span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected && !isRemoved ? 'bg-emerald-400' : 'bg-white/20'}`}
                        animate={!connected ? { opacity: [1, 0.3, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                </div>
            </div>

            {/* Monaco Editor (read-only live preview) */}
            <div className="flex-1 bg-black/40">
                <Editor
                    height="100%"
                    language="javascript"
                    theme="vs-dark"
                    onMount={handleMount}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 12,
                        scrollBeyondLastLine: false,
                        padding: { top: 10 },
                        readOnly: true,
                    }}
                />
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────
// Event type badge helper
// ─────────────────────────────────────────────────────
const EVENT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    COPY_PASTE_ALERT: { label: 'Paste Alert', color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/25', icon: <ShieldAlert size={15} /> },
    TAB_SWITCH:       { label: 'Tab Switch',  color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/25', icon: <AppWindow size={15} /> },
    FULLSCREEN_EXIT:  { label: 'FS Exit',     color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/25', icon: <MonitorOff size={15} /> },
    JOIN:             { label: 'Join',         color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', icon: <UserPlus size={15} /> },
    EXECUTE:          { label: 'Execute',      color: 'text-indigo-300', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: <Terminal size={15} /> },
    SUSPICIOUS_BEHAVIOR: { label: 'Removed',  color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/25', icon: <UserX size={15} /> },
};

// ─────────────────────────────────────────────────────
// Main AdminMonitor page
// ─────────────────────────────────────────────────────
export default function AdminMonitor() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();

    const [logs, setLogs] = useState<ExamLog[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [students, setStudents] = useState<Map<string, string>>(new Map());
    const [filterType, setFilterType] = useState<string>('ALL');
    const [filterStudent, setFilterStudent] = useState<string>('ALL');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [examId]);

    const fetchData = async (showLoader = false) => {
        if (showLoader) setRefreshing(true);
        try {
            const [logsData, sessionsData] = await Promise.all([
                getExamLogs(examId!),
                getExamSessions(examId!)
            ]);
            setLogs(logsData);
            setSessions(sessionsData);

            const activeStudents = new Map<string, string>();
            sessionsData.forEach((s: any) => {
                if (s.user) activeStudents.set(s.userId, s.user.username);
            });
            logsData.forEach(log => {
                if (log.user && !activeStudents.has(log.userId)) {
                    activeStudents.set(log.userId, log.user.username);
                }
            });
            setStudents(activeStudents);
        } catch (err) {
            console.error('Failed to load monitor data', err);
        } finally {
            if (showLoader) setRefreshing(false);
        }
    };

    const handleBlock = async (studentId: string) => {
        try {
            await blockStudent(examId!, studentId, 'Manually blocked by admin');
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleUnblock = async (studentId: string) => {
        try {
            await unblockStudent(examId!, studentId);
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleRemove = async (studentId: string) => {
        try {
            await removeStudent(examId!, studentId);
            fetchData();
        } catch (err) { console.error(err); }
    };

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const typeMatch = filterType === 'ALL' || log.eventType === filterType;
        const studentMatch = filterStudent === 'ALL' || log.userId === filterStudent;
        return typeMatch && studentMatch;
    });

    // Stats
    const totalStudents = students.size;
    const blockedCount = sessions.filter(s => s.isBlocked).length;
    const totalSwitches = sessions.reduce((sum, s) => sum + (s.tabSwitchCount || 0), 0);
    const alertCount = logs.filter(l => l.eventType === 'COPY_PASTE_ALERT').length;

    return (
        <div className="flex h-screen bg-gradient-to-br from-[#090d1f] via-[#0f172a] to-[#090d1f] text-white overflow-hidden font-sans relative">
            {/* BG glow */}
            <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/15 blur-[140px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-violet-500/15 blur-[140px] rounded-full pointer-events-none" />

            {/* ── Left Panel: Student Code Previews ── */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 flex flex-col gap-6">
                {/* Header */}
                <motion.div
                    className="flex items-center gap-4 bg-white/10 backdrop-blur-xl p-4 border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <button
                        onClick={() => navigate('/admin')}
                        className="p-2.5 bg-white/5 hover:bg-white/15 rounded-xl transition-all border border-white/10 group flex-shrink-0"
                    >
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 to-violet-200">
                            Live Exam Monitor
                        </h1>
                        <p className="text-white/50 text-sm mt-0.5">Anti-cheat surveillance & real-time code inspection</p>
                    </div>
                    <button
                        onClick={() => fetchData(true)}
                        className={`p-2.5 bg-white/5 hover:bg-white/15 rounded-xl border border-white/10 transition-all ${refreshing ? 'animate-spin text-indigo-300' : 'text-white/60 hover:text-white'}`}
                        title="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    {[
                        { label: 'Students', value: totalStudents, color: 'text-indigo-300', icon: <Users size={18} /> },
                        { label: 'Blocked', value: blockedCount, color: 'text-red-300', icon: <Ban size={18} /> },
                        { label: 'Tab Switches', value: totalSwitches, color: 'text-orange-300', icon: <AppWindow size={18} /> },
                        { label: 'Paste Alerts', value: alertCount, color: 'text-red-400', icon: <ShieldAlert size={18} /> },
                    ].map(stat => (
                        <div key={stat.label} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 flex items-center gap-3">
                            <div className={`${stat.color} opacity-80`}>{stat.icon}</div>
                            <div>
                                <div className={`text-xl font-black ${stat.color}`}>{stat.value}</div>
                                <div className="text-xs text-white/50 font-medium">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Student Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
                    {Array.from(students.entries()).map(([id, username]) => {
                        const sess = sessions.find(s => s.userId === id);
                        return (
                            <StudentPreview
                                key={id}
                                examId={examId!}
                                studentId={id}
                                studentName={username}
                                session={sess}
                                onBlock={handleBlock}
                                onUnblock={handleUnblock}
                                onRemove={handleRemove}
                            />
                        );
                    })}
                    {students.size === 0 && (
                        <motion.div
                            className="col-span-full h-56 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-2xl border border-dashed border-white/15 text-white/40"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                        >
                            <div className="text-center">
                                <MonitorOff size={44} className="mx-auto mb-3 opacity-40" />
                                <p className="font-medium">Waiting for students to join...</p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── Right Panel: Event Log Console ── */}
            <div className="w-[420px] bg-white/5 backdrop-blur-xl flex flex-col border-l border-white/10 relative z-10">
                {/* Console Header */}
                <div className="p-5 border-b border-white/10 flex flex-col gap-4 bg-gradient-to-b from-white/8 to-transparent">
                    <h2 className="font-bold text-xl tracking-tight flex items-center gap-2.5">
                        <Terminal size={20} className="text-indigo-300" />
                        Event Console
                        <span className="ml-auto text-sm font-normal text-white/40 bg-white/10 px-2 py-0.5 rounded-full border border-white/10">
                            {filteredLogs.length} events
                        </span>
                    </h2>

                    {/* Filters */}
                    <div className="flex flex-col gap-2">
                        {/* Event type filter */}
                        <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 px-3 py-2">
                            <Filter size={14} className="text-white/50 flex-shrink-0" />
                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="flex-1 bg-transparent text-sm text-white outline-none appearance-none cursor-pointer"
                            >
                                <option value="ALL" className="bg-slate-900">All Event Types</option>
                                <option value="COPY_PASTE_ALERT" className="bg-slate-900">Paste Alerts</option>
                                <option value="TAB_SWITCH" className="bg-slate-900">Tab Switches</option>
                                <option value="FULLSCREEN_EXIT" className="bg-slate-900">Fullscreen Exits</option>
                                <option value="EXECUTE" className="bg-slate-900">Executions</option>
                                <option value="JOIN" className="bg-slate-900">Joins</option>
                                <option value="SUSPICIOUS_BEHAVIOR" className="bg-slate-900">Removals</option>
                            </select>
                            <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
                        </div>

                        {/* Student filter */}
                        {students.size > 0 && (
                            <div className="flex items-center gap-2 bg-black/20 rounded-xl border border-white/10 px-3 py-2">
                                <Users size={14} className="text-white/50 flex-shrink-0" />
                                <select
                                    value={filterStudent}
                                    onChange={e => setFilterStudent(e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-white outline-none appearance-none cursor-pointer"
                                >
                                    <option value="ALL" className="bg-slate-900">All Students</option>
                                    {Array.from(students.entries()).map(([id, name]) => (
                                        <option key={id} value={id} className="bg-slate-900">{name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="text-white/40 flex-shrink-0" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <AnimatePresence initial={false}>
                        {filteredLogs.map((log, index) => {
                            const meta = EVENT_META[log.eventType] || {
                                label: log.eventType, color: 'text-white/70',
                                bg: 'bg-white/5', border: 'border-white/10',
                                icon: <Terminal size={15} />
                            };
                            let details: any = {};
                            try {
                                details = log.details ? JSON.parse(log.details) : {};
                            } catch (e) {
                                details = { message: log.details };
                            }

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.3 }}
                                    className={`p-3.5 rounded-xl border flex flex-col gap-2 ${meta.bg} ${meta.border}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg bg-black/30 ${meta.color}`}>
                                                {meta.icon}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-white/90">
                                                    {log.user?.username || log.userId.substring(0, 8)}
                                                </div>
                                                <div className={`text-xs font-bold uppercase tracking-wide ${meta.color}`}>
                                                    {meta.label}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium text-white/40 bg-black/30 px-2 py-1 rounded-lg flex-shrink-0">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Event details */}
                                    <div className={`text-sm leading-relaxed ${meta.color}`}>
                                        {log.eventType === 'COPY_PASTE_ALERT' && (
                                            <span>
                                                <strong>Mass paste detected:</strong>{' '}
                                                <code className="bg-black/40 px-1.5 py-0.5 rounded text-xs">{details.pastedLength} chars</code>
                                                {log.codeSnapshot && (
                                                    <div className="mt-2 bg-black/50 border border-white/5 rounded-lg p-2 text-xs font-mono text-white/60 whitespace-pre-wrap break-all">
                                                        {log.codeSnapshot.substring(0, 80)}{log.codeSnapshot.length > 80 ? '...' : ''}
                                                    </div>
                                                )}
                                            </span>
                                        )}
                                        {log.eventType === 'TAB_SWITCH' && <span>Switched tabs during exam</span>}
                                        {log.eventType === 'FULLSCREEN_EXIT' && <span>Exited fullscreen mode</span>}
                                        {log.eventType === 'JOIN' && <span className="text-emerald-300">{details.message || 'Joined the exam'}</span>}
                                        {log.eventType === 'EXECUTE' && (
                                            <span>
                                                Executed code{' '}
                                                <code className="bg-black/40 px-1.5 py-0.5 rounded text-xs">exit: {details.exitCode ?? 'N/A'}</code>{' '}
                                                <code className="bg-black/40 px-1.5 py-0.5 rounded text-xs">{details.executionTime ?? '?'}ms</code>
                                            </span>
                                        )}
                                        {log.eventType === 'SUSPICIOUS_BEHAVIOR' && <span className="text-red-300">{details.message || 'Removed by admin'}</span>}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {filteredLogs.length === 0 && (
                        <div className="h-32 flex items-center justify-center text-white/30 text-sm">
                            No events to display
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
