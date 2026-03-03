import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamLogs } from '../api';
import type { ExamLog } from '../api';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { ShieldAlert, Terminal, ArrowLeft, Filter, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrutalButton from '../components/ui/BrutalButton';

const StudentPreview = ({ examId, studentId, studentName }: { examId: string, studentId: string, studentName: string }) => {
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

        // Connect to the student's per-user Yjs document via admin monitor mode.
        // Room name must be unique per student so the y-websocket client doesn't
        // merge multiple monitors into one local doc.
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

    return (
        <motion.div
            className="bg-neo-bg border-4 border-neo-border shadow-brutal flex flex-col h-[350px]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        >
            <div className={`px-4 py-3 border-b-4 border-neo-border flex justify-between items-center ${connected ? 'bg-neo-accent' : 'bg-neo-error'}`}>
                <span className={`font-black uppercase tracking-wide ${connected ? 'text-neo-accent-text' : 'text-white'}`}>
                    {studentName}{' '}
                    <span className="text-xs uppercase ml-2 bg-neo-bg px-2 py-1 text-neo-text border-2 border-neo-border">Live</span>
                </span>
                <motion.span
                    className={`w-4 h-4 rounded-full border-2 border-neo-border ${connected ? 'bg-neo-success' : 'bg-neo-error'}`}
                    animate={!connected ? { opacity: [1, 0.3, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                />
            </div>
            <div className="flex-1 bg-[#1e1e1e] border-t-2 border-neo-border editor-root" data-theme="dark">
                <Editor
                    height="100%"
                    language="javascript"
                    theme="vs-dark"
                    onMount={handleMount}
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
                />
            </div>
        </motion.div>
    );
};

export default function AdminMonitor() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const [logs, setLogs] = useState<ExamLog[]>([]);
    const [students, setStudents] = useState<Map<string, string>>(new Map()); // id -> username
    const [filterType, setFilterType] = useState<string>('ALL'); // ALL, EXECUTE, COPY_PASTE_ALERT, JOIN

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [examId]);

    const fetchLogs = async () => {
        try {
            const data = await getExamLogs(examId!);
            setLogs(data);

            // Extract unique students
            const activeStudents = new Map<string, string>();
            data.forEach(log => {
                if (log.user) activeStudents.set(log.userId, log.user.username);
            });
            setStudents(activeStudents);
        } catch (err) {
            console.error('Failed to load logs', err);
        }
    };

    return (
        <div className="flex h-screen bg-neo-bg text-neo-text overflow-hidden font-sans">
            {/* Left Panel: Live Code Previews */}
            <div className="flex-1 overflow-y-auto p-8 border-r-4 border-neo-border bg-neo-bg">
                <motion.div
                    className="flex items-center gap-6 mb-8 bg-neo-surface p-4 border-4 border-neo-border shadow-brutal"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <BrutalButton variant="secondary" onClick={() => navigate('/admin')}>
                        <ArrowLeft size={24} />
                    </BrutalButton>
                    <h1 className="text-3xl font-black uppercase tracking-tight text-neo-text">
                        Live Exam Monitoring
                    </h1>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-8">
                    {Array.from(students.entries()).map(([id, username]) => (
                        <StudentPreview key={id} examId={examId!} studentId={id} studentName={username} />
                    ))}
                    {students.size === 0 && (
                        <motion.div
                            className="col-span-full h-40 flex items-center justify-center font-bold text-xl uppercase bg-neo-surface border-4 border-neo-border shadow-brutal-sm p-8 text-center border-dashed text-neo-text-secondary"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                        >
                            Waiting for students to join or execute code...
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Right Panel: Event Logs Feed */}
            <div className="w-[450px] bg-neo-surface flex flex-col border-l-4 border-neo-border">
                <div className="p-4 border-b-4 border-neo-border flex flex-col gap-4 bg-neo-accent">
                    <h2 className="font-black text-2xl uppercase tracking-tighter text-neo-accent-text">Event Log</h2>
                    <div className="flex items-center gap-4 w-full">
                        <div className="bg-neo-bg border-4 border-neo-border p-2">
                            <Filter size={20} className="text-neo-text" />
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="flex-1 bg-neo-bg border-4 border-neo-border text-lg font-bold text-neo-text px-4 py-2 outline-none shadow-brutal-sm appearance-none rounded-none cursor-pointer"
                        >
                            <option value="ALL">ALL EVENTS</option>
                            <option value="EXECUTE">EXECUTIONS</option>
                            <option value="COPY_PASTE_ALERT">PASTE ALERTS</option>
                            <option value="JOIN">JOINS</option>
                        </select>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-neo-bg">
                    <AnimatePresence>
                        {logs.filter(log => filterType === 'ALL' || log.eventType === filterType).map((log, index) => {
                            const isAlert = log.eventType === 'COPY_PASTE_ALERT';
                            const isJoin = log.eventType === 'JOIN';
                            const details = log.details ? JSON.parse(log.details) : {};

                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.03, duration: 0.3 }}
                                    className={`p-4 border-4 shadow-brutal-sm flex flex-col gap-2 ${isAlert ? 'bg-neo-error border-neo-border text-white' : isJoin ? 'bg-neo-success border-neo-border text-neo-accent-text' : 'bg-neo-surface border-neo-border'}`}
                                >
                                    <div className="flex justify-between items-start mb-2 border-b-2 border-neo-border pb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 border-2 border-neo-border bg-neo-bg">
                                                {isAlert ? <ShieldAlert size={20} className="text-neo-error" /> : isJoin ? <UserPlus size={20} className="text-neo-success" /> : <Terminal size={20} className="text-neo-text" />}
                                            </div>
                                            <span className={`font-black text-lg uppercase ${isAlert ? 'text-white' : isJoin ? 'text-neo-accent-text' : 'text-neo-text'}`}>
                                                {log.user?.username || log.userId}
                                            </span>
                                        </div>
                                        <span className="text-sm font-bold px-2 py-1 border-2 border-neo-border bg-neo-bg text-neo-text">
                                            {new Date(log.createdAt).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className={`font-semibold text-base leading-relaxed ${!isAlert && !isJoin ? 'text-neo-text' : ''}`}>
                                        {isAlert && <span>🚨 <span className="font-black uppercase tracking-wide">Mass Paste Detected:</span> <span className="font-mono bg-neo-bg text-neo-text px-2 py-1 mx-1 border-2 border-neo-border">{details.pastedLength}</span> chars</span>}
                                        {log.eventType === 'EXECUTE' && <span><span className="font-black uppercase">Executed code</span><br /><span className="inline-block mt-2 px-2 py-1 bg-neo-bg border-2 border-neo-border text-sm text-neo-text">EXIT: {details.exitCode ?? 'N/A'}</span> <span className="inline-block mt-2 px-2 py-1 bg-neo-bg border-2 border-neo-border text-sm ml-2 text-neo-text">TIME: {details.executionTime ?? '?'}ms</span></span>}
                                        {isJoin && <span className="font-black uppercase">{details.message || 'Joined the exam.'}</span>}
                                    </div>
                                    {isAlert && log.codeSnapshot && (
                                        <div className="mt-4 bg-[#1e1e1e] border-2 border-neo-border p-3 text-sm font-mono text-green-400 whitespace-pre-wrap break-all">
                                            {log.codeSnapshot.substring(0, 100)}...
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
