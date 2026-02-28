import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getExamLogs } from '../api';
import type { ExamLog } from '../api';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { ShieldAlert, Terminal, ArrowLeft, Filter, UserPlus } from 'lucide-react';

const StudentPreview = ({ examId, studentName }: { examId: string, studentName: string }) => {
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

        // Connect as a read-only viewer to the student's specific namespace
        const wsProvider = new WebsocketProvider(wsUrl, `/e/${examId}/s/${studentName}`, doc, {
            params: token ? { token } : {}
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
        <div className="bg-[#252526] rounded-xl border border-[#333] overflow-hidden flex flex-col h-[300px]">
            <div className={`px-4 py-2 border-b border-[#333] flex justify-between items-center text-sm ${connected ? 'bg-blue-900/20' : 'bg-red-900/20'}`}>
                <span className="font-semibold text-gray-200">{studentName} (Live)</span>
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
            </div>
            <div className="flex-1">
                <Editor
                    height="100%"
                    language="javascript"
                    theme="vs-dark"
                    onMount={handleMount}
                    options={{ minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false }}
                />
            </div>
        </div>
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
        <div className="flex h-screen bg-[#1e1e1e] text-white overflow-hidden">
            {/* Left Panel: Live Code Previews */}
            <div className="flex-1 overflow-y-auto p-6 border-r border-[#333]">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate('/admin')} className="text-[#969696] hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        Live Exam Monitoring
                    </h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Array.from(students.entries()).map(([id, username]) => (
                        <StudentPreview key={id} examId={examId!} studentName={username} />
                    ))}
                    {students.size === 0 && (
                        <div className="col-span-full h-40 flex items-center justify-center text-[#969696] border border-dashed border-[#555] rounded-xl">
                            Waiting for students to join or execute code...
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Event Logs Feed */}
            <div className="w-[450px] bg-[#252526] flex flex-col">
                <div className="h-14 border-b border-[#333] flex items-center justify-between px-6">
                    <h2 className="font-bold">Audit Event Log</h2>
                    <div className="flex items-center gap-2">
                        <Filter size={14} className="text-[#969696]" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-[#1e1e1e] border border-[#3c3c3c] text-sm text-[#d4d4d4] rounded px-2 py-1 outline-none"
                        >
                            <option value="ALL">All Events</option>
                            <option value="EXECUTE">Executions</option>
                            <option value="COPY_PASTE_ALERT">Paste Alerts</option>
                            <option value="JOIN">Joins</option>
                        </select>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {logs.filter(log => filterType === 'ALL' || log.eventType === filterType).map(log => {
                        const isAlert = log.eventType === 'COPY_PASTE_ALERT';
                        const isJoin = log.eventType === 'JOIN';
                        const details = log.details ? JSON.parse(log.details) : {};

                        return (
                            <div key={log.id} className={`p-4 rounded-lg border ${isAlert ? 'bg-red-900/20 border-red-500/50' : isJoin ? 'bg-green-900/10 border-green-500/30' : 'bg-[#1e1e1e] border-[#333]'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        {isAlert ? <ShieldAlert size={16} className="text-red-500" /> : isJoin ? <UserPlus size={16} className="text-green-500" /> : <Terminal size={16} className="text-blue-500" />}
                                        <span className={`font-semibold ${isAlert ? 'text-red-400' : isJoin ? 'text-green-400' : 'text-blue-400'}`}>
                                            {log.user?.username || log.userId}
                                        </span>
                                    </div>
                                    <span className="text-xs text-[#969696]">
                                        {new Date(log.createdAt).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-300">
                                    {isAlert && <span>🚨 Mass Paste Detected: <span className="font-mono text-red-300">{details.pastedLength}</span> chars</span>}
                                    {log.eventType === 'EXECUTE' && <span>Executed code. <br /><span className="text-[#969696]">Exit Code: {details.exitCode ?? 'N/A'} | Time: {details.executionTime ?? '?'}ms</span></span>}
                                    {isJoin && <span>{details.message || 'Joined the exam.'}</span>}
                                </div>
                                {isAlert && log.codeSnapshot && (
                                    <div className="mt-2 bg-black py-2 px-3 rounded text-xs font-mono text-gray-400 truncate border border-red-900">
                                        {log.codeSnapshot.substring(0, 100)}...
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
}

