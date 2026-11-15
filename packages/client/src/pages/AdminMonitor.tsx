import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamLogs, getExamSessions, blockStudent, unblockStudent, removeStudent } from '../api';
import type { ExamLog } from '../api';
import LiveCodePreview from '../components/LiveCodePreview';
import { useToast } from '../contexts/toast';
import {
    ShieldAlert, Terminal, ArrowLeft, Filter, UserPlus, MonitorOff,
    AppWindow, Ban, CheckCircle, UserX, Users, RefreshCw, ChevronDown
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import { buttonClass } from '../components/ui/buttonStyles';
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
    const [viewingFile, setViewingFile] = useState<string | null>(null);

    const isRemoved = session?.status === 'REMOVED';

    return (
        <motion.div
            className={`ui-card flex h-[360px] flex-col overflow-hidden ${isRemoved ? 'opacity-60' : session?.isBlocked ? 'ring-1 ring-danger/50' : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Card Header */}
            <div className={`flex items-center justify-between border-b border-line px-4 py-3 ${isRemoved ? 'bg-tint-1' : session?.isBlocked ? 'bg-danger/10' : connected ? 'bg-success/10' : 'bg-chrome'}`}>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-fg flex items-center gap-2">
                        {studentName}
                        {isRemoved && <span className="inline-flex h-5 items-center rounded-full bg-tint-2 px-2 text-[11px] font-medium text-fg-2">Removed</span>}
                        {session?.isBlocked && !isRemoved && <span className="inline-flex h-5 items-center rounded-full bg-danger/15 px-2 text-[11px] font-medium text-danger-text">Blocked</span>}
                        {connected && !session?.isBlocked && !isRemoved && <span className="inline-flex h-5 items-center rounded-full bg-success/15 px-2 text-[11px] font-medium text-success-text">Live</span>}
                    </span>
                    <span className="text-xs text-fg-2">
                        Tab switches: <span className={session?.tabSwitchCount >= 3 ? 'text-danger-text font-semibold' : 'text-fg'}>{session?.tabSwitchCount || 0}</span>/3
                    </span>
                </div>
                <div className="flex gap-2 items-center">
                    {!isRemoved && (
                        session?.isBlocked ? (
                            <button
                                onClick={() => onUnblock(studentId)}
                                className={buttonClass('success', 'sm')}
                            >
                                <CheckCircle size={14} /> Unblock
                            </button>
                        ) : (
                            <button
                                onClick={() => onBlock(studentId)}
                                className={buttonClass('danger', 'sm')}
                            >
                                <Ban size={14} /> Block
                            </button>
                        )
                    )}
                    {!isRemoved && (
                        <button
                            onClick={() => onRemove(studentId)}
                            className={buttonClass('secondary', 'sm')}
                            title="Remove student from exam"
                        >
                            <UserX size={14} /> Remove
                        </button>
                    )}
                    <motion.span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected && !isRemoved ? 'bg-success' : 'bg-tint-5'}`}
                        animate={!connected ? { opacity: [1, 0.3, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                </div>
            </div>

            {/* Monaco Editor (read-only live preview of the student's open file) */}
            <div className="px-4 py-1 text-xs text-fg-3 font-mono truncate border-b border-line-faint">
                {viewingFile ?? 'No file open'}
            </div>
            <div className="flex-1 bg-canvas">
                <LiveCodePreview
                    roomName={`admin-monitor-${studentId}`}
                    params={{ examId, studentId, mode: 'admin-monitor' }}
                    followUserId={studentId}
                    onConnectedChange={setConnected}
                    onViewingFileChange={setViewingFile}
                />
            </div>
        </motion.div>
    );
};

// ─────────────────────────────────────────────────────
// Event type badge helper
// ─────────────────────────────────────────────────────
const EVENT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
    COPY_PASTE_ALERT: { label: 'Paste alert', color: 'text-danger-text', bg: 'bg-danger/15', border: '', icon: <ShieldAlert size={15} /> },
    TAB_SWITCH:       { label: 'Tab switch',  color: 'text-warning-text', bg: 'bg-warning/15', border: '', icon: <AppWindow size={15} /> },
    FULLSCREEN_EXIT:  { label: 'FS Exit',     color: 'text-warning-text', bg: 'bg-warning/15', border: '', icon: <MonitorOff size={15} /> },
    JOIN:             { label: 'Join',         color: 'text-success-text', bg: 'bg-success/15', border: '', icon: <UserPlus size={15} /> },
    EXECUTE:          { label: 'Execute',      color: 'text-accent-text', bg: 'bg-accent/10', border: '', icon: <Terminal size={15} /> },
    SUSPICIOUS_BEHAVIOR: { label: 'Removed',  color: 'text-danger-text', bg: 'bg-danger/15', border: '', icon: <UserX size={15} /> },
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
    const toast = useToast();
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
            toast.success('Student blocked', students.get(studentId));
        } catch (err: any) {
            console.error(err);
            toast.error('Could not block the student', err.message);
        }
    };

    const handleUnblock = async (studentId: string) => {
        try {
            await unblockStudent(examId!, studentId);
            fetchData();
            toast.success('Student unblocked', students.get(studentId));
        } catch (err: any) {
            console.error(err);
            toast.error('Could not unblock the student', err.message);
        }
    };

    const handleRemove = async (studentId: string) => {
        try {
            await removeStudent(examId!, studentId);
            fetchData();
            toast.success('Student removed', students.get(studentId));
        } catch (err: any) {
            console.error(err);
            toast.error('Could not remove the student', err.message);
        }
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
        <div className="relative flex h-screen overflow-hidden bg-canvas font-sans text-fg">

            {/* ── Left Panel: Student Code Previews ── */}
            <main id="main-content" tabIndex={-1} className="relative z-10 flex flex-1 flex-col gap-6 overflow-y-auto p-6 focus:outline-none">
                {/* Header */}
                <motion.div
                    className="ui-card flex items-center gap-4 p-4"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <button
                        onClick={() => navigate('/admin')}
                        aria-label="Back to exams"
                        className="shrink-0 rounded-lg bg-tint-2 p-2 text-fg-2 transition-colors hover:bg-tint-3 hover:text-fg"
                    >
                        <ArrowLeft size={17} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-semibold tracking-tight text-fg">
                            Live exam monitor
                        </h1>
                        <p className="text-fg-3 text-sm mt-0.5">Anti-cheat monitoring and real-time code inspection</p>
                    </div>
                    <button
                        onClick={() => fetchData(true)}
                        className={`rounded-lg bg-tint-2 p-2 text-fg-2 transition-colors hover:bg-tint-3 hover:text-fg ${refreshing ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                    <ThemeToggle />
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                >
                    {[
                        { label: 'Students', value: totalStudents, color: 'text-accent-text', icon: <Users size={18} /> },
                        { label: 'Blocked', value: blockedCount, color: 'text-danger-text', icon: <Ban size={18} /> },
                        { label: 'Tab switches', value: totalSwitches, color: 'text-warning-text', icon: <AppWindow size={18} /> },
                        { label: 'Paste alerts', value: alertCount, color: 'text-danger-text', icon: <ShieldAlert size={18} /> },
                    ].map(stat => (
                        <div key={stat.label} className="ui-card flex items-center gap-3 p-4">
                            <div className={stat.color}>{stat.icon}</div>
                            <div>
                                <div className={`text-xl font-semibold ${stat.color}`}>{stat.value}</div>
                                <div className="text-xs text-fg-3 font-medium">{stat.label}</div>
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
                            className="ui-card col-span-full flex h-56 items-center justify-center text-fg-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                        >
                            <div className="text-center">
                                <MonitorOff size={32} className="mx-auto mb-3 opacity-60" />
                                <p className="font-medium">Waiting for students to join…</p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* ── Right Panel: Event Log Console ── */}
            <div className="relative z-10 flex w-[420px] flex-col border-l border-line bg-surface">
                {/* Console Header */}
                <div className="flex flex-col gap-4 border-b border-line p-5">
                    <h2 className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
                        <Terminal size={18} className="text-fg-3" />
                        Event console
                        <span className="ml-auto inline-flex h-5 items-center rounded-full bg-tint-2 px-2 text-[11px] font-medium text-fg-2">
                            {filteredLogs.length} events
                        </span>
                    </h2>

                    {/* Filters */}
                    <div className="flex flex-col gap-2">
                        {/* Event type filter */}
                        <div className="flex items-center gap-2 bg-canvas rounded-lg border border-line px-3 py-2">
                            <Filter size={14} className="text-fg-3 flex-shrink-0" />
                            <select
                                aria-label="Filter by event type"
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="flex-1 bg-transparent text-sm text-fg outline-none appearance-none cursor-pointer"
                            >
                                <option value="ALL" className="bg-surface">All event types</option>
                                <option value="COPY_PASTE_ALERT" className="bg-surface">Paste alerts</option>
                                <option value="TAB_SWITCH" className="bg-surface">Tab switches</option>
                                <option value="FULLSCREEN_EXIT" className="bg-surface">Fullscreen exits</option>
                                <option value="EXECUTE" className="bg-surface">Executions</option>
                                <option value="JOIN" className="bg-surface">Joins</option>
                                <option value="SUSPICIOUS_BEHAVIOR" className="bg-surface">Removals</option>
                            </select>
                            <ChevronDown size={14} className="text-fg-3 flex-shrink-0" />
                        </div>

                        {/* Student filter */}
                        {students.size > 0 && (
                            <div className="flex items-center gap-2 bg-canvas rounded-lg border border-line px-3 py-2">
                                <Users size={14} className="text-fg-3 flex-shrink-0" />
                                <select
                                    aria-label="Filter by student"
                                    value={filterStudent}
                                    onChange={e => setFilterStudent(e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-fg outline-none appearance-none cursor-pointer"
                                >
                                    <option value="ALL" className="bg-surface">All students</option>
                                    {Array.from(students.entries()).map(([id, name]) => (
                                        <option key={id} value={id} className="bg-surface">{name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="text-fg-3 flex-shrink-0" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Log Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <AnimatePresence initial={false}>
                        {filteredLogs.map((log, index) => {
                            const meta = EVENT_META[log.eventType] || {
                                label: log.eventType, color: 'text-fg-2',
                                bg: 'bg-tint-1', border: 'border-line',
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
                                    className={`p-3.5 rounded-lg border flex flex-col gap-2 ${meta.bg} ${meta.border}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg bg-canvas ${meta.color}`}>
                                                {meta.icon}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm text-fg">
                                                    {log.user?.username || log.userId.substring(0, 8)}
                                                </div>
                                                <div className={`text-xs font-semibold ${meta.color}`}>
                                                    {meta.label}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[11px] font-medium text-fg-3 bg-canvas px-2 py-1 rounded-lg flex-shrink-0">
                                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Event details */}
                                    <div className={`text-sm leading-relaxed ${meta.color}`}>
                                        {log.eventType === 'COPY_PASTE_ALERT' && (
                                            <span>
                                                <strong>Mass paste detected:</strong>{' '}
                                                <code className="bg-canvas px-1.5 py-0.5 rounded text-xs">{details.pastedLength} chars</code>
                                                {log.codeSnapshot && (
                                                    <div className="mt-2 bg-canvas border border-line-faint rounded-lg p-2 text-xs font-mono text-fg-2 whitespace-pre-wrap break-all">
                                                        {log.codeSnapshot.substring(0, 80)}{log.codeSnapshot.length > 80 ? '...' : ''}
                                                    </div>
                                                )}
                                            </span>
                                        )}
                                        {log.eventType === 'TAB_SWITCH' && <span>Switched tabs during exam</span>}
                                        {log.eventType === 'FULLSCREEN_EXIT' && <span>Exited fullscreen mode</span>}
                                        {log.eventType === 'JOIN' && <span className="text-success-text">{details.message || 'Joined the exam'}</span>}
                                        {log.eventType === 'EXECUTE' && (
                                            <span>
                                                Executed code{' '}
                                                <code className="bg-canvas px-1.5 py-0.5 rounded text-xs">exit: {details.exitCode ?? 'N/A'}</code>{' '}
                                                <code className="bg-canvas px-1.5 py-0.5 rounded text-xs">{details.executionTime ?? '?'}ms</code>
                                            </span>
                                        )}
                                        {log.eventType === 'SUSPICIOUS_BEHAVIOR' && <span className="text-danger-text">{details.message || 'Removed by admin'}</span>}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {filteredLogs.length === 0 && (
                        <div className="h-32 flex items-center justify-center text-fg-3 text-sm">
                            No events to display
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
