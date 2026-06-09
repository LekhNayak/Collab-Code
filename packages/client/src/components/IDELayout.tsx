import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type WebsocketProvider } from 'y-websocket';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from './ui/Modal';
import {
    Files,
    Search,
    GitBranch,
    Settings,
    PanelBottomOpen,
    PanelBottomClose,
    Users,
    Share2,
    Copy,
    FilePlus2,
    FolderPlus,
    Plus,
    X,
    Puzzle,
    Upload,
    FolderArchive,
    Download, // Added Download icon
} from 'lucide-react';
import FileExplorer, { type FileNode } from './FileExplorer';
import EditorTabs, { type TabInfo } from './EditorTabs';
import CodeEditor, { getLanguageFromFilename } from './Editor';
import StatusBar from './StatusBar';
import Terminal from './Terminal';
import GitPanel from './GitPanel';
import ExtensionPanel from './ExtensionPanel';
import UserPresence from './UserPresence';
import { getFileTree, readFile, saveFile, initWorkspace, createFile as apiCreateFile, moveFile as apiMoveFile, deleteFile as apiDeleteFile, getSession, saveSession, createSession, getExtensions, uploadZip, uploadFolder, joinExam, downloadWorkspace, resolveExamRoom, sendTabSwitch, sendFullscreenExit, sendExamAlert, getMyExamSession, type SessionInfo, type ExtensionInfo, type ExamRoom } from '../api';
import '../ide.css';

type SidebarPanel = 'explorer' | 'search' | 'git' | 'users' | 'extensions';

// In-memory file content cache
const fileContents = new Map<string, string>();
// Tracks the last content successfully written to disk — used to determine real dirty state
const lastSavedContent = new Map<string, string>();

export default function IDELayout({ isExamMode: manualExamMode }: { isExamMode?: boolean }) {
    const { roomId } = useParams<{ roomId?: string }>();
    const navigate = useNavigate();
    const username = localStorage.getItem('collab-username') || 'Anonymous';

    const isExamMode = manualExamMode || (roomId && roomId.startsWith('EX-'));
    const [roomBlocked, setRoomBlocked] = useState(false);
    const [roomBlockReason, setRoomBlockReason] = useState('');
    const [examOverlay, setExamOverlay] = useState<{ type: 'fullscreen' | 'tab-switch'; switchCount?: number } | null>(null);
    const [editorAlert, setEditorAlert] = useState<string | null>(null);

    // Extract user ID from JWT for per-student workspace isolation
    const getUserIdFromToken = (): string | null => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.id || null;
        } catch { return null; }
    };
    const currentUserId = getUserIdFromToken();

    // In exam mode, workspace must be isolated per student
    // Each student gets their own workspace: EX-a1b2c3d4__userId
    const workspaceId = isExamMode && roomId && currentUserId
        ? `${roomId}__${currentUserId}`
        : (roomId || 'default');

    const [activePanel, setActivePanel] = useState<SidebarPanel>('explorer');
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [tabs, setTabs] = useState<TabInfo[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');
    const [panelOpen, setPanelOpen] = useState(false);
    const [panelHeight, setPanelHeight] = useState(200);
    const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
    const [provider, setProvider] = useState<WebsocketProvider | null>(null);
    const [copied, setCopied] = useState(false);
    const [files, setFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [creatingFile, setCreatingFile] = useState<'file' | 'folder' | null>(null);
    const [newFileName, setNewFileName] = useState('');

    const [resolvedExamId, setResolvedExamId] = useState<string | null>(null);

    const [examData, setExamData] = useState<ExamRoom | null>(null);
    const [timeLeft, setTimeLeft] = useState<string>('');

    // Session & Extensions state
    const [sessionData, setSessionData] = useState<SessionInfo | null>(null);
    const [allExtensions, setAllExtensions] = useState<ExtensionInfo[]>([]);
    const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Resolve exam room code -> exam metadata
    useEffect(() => {
        if (isExamMode && roomId && roomId.startsWith('EX-')) {
            resolveExamRoom(roomId)
                .then(({ exam }) => {
                    setResolvedExamId(exam.id);
                    setExamData(exam);
                })
                .catch(err => {
                    console.error('Failed to resolve exam room:', err);
                    setRoomBlocked(true);
                    setRoomBlockReason('This exam room code is invalid or does not exist in the system.');
                });
        }
    }, [isExamMode, roomId]);

    // Timer logic
    useEffect(() => {
        if (!examData || !examData.endTime) return;

        const updateTimer = () => {
            const end = new Date(examData.endTime!).getTime();
            const now = Date.now();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('00:00:00 - Time is up!');
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [examData]);

    // Exit fullscreen whenever the student is kicked/blocked or leaves exam
    useEffect(() => {
        if (roomBlocked && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }, [roomBlocked]);

    // Notify backend when student joins exam
    useEffect(() => {
        if (isExamMode && resolvedExamId) {
            joinExam(resolvedExamId).catch(err => console.error('Failed to log join event:', err));
        }
    }, [isExamMode, resolvedExamId]);

    // Anti-cheat restrictions (copy-paste + tab-switch + fullscreen + keyboard blocking)
    useEffect(() => {
        if (!isExamMode || !resolvedExamId || roomBlocked) return;

        const enterFullscreen = () => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        // ── Tab-switch detection ──
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                try {
                    const data = await sendTabSwitch(resolvedExamId);
                    if (data.session?.isBlocked) {
                        setRoomBlocked(true);
                        setRoomBlockReason('You have been blocked from the exam for exceeding the maximum allowed tab switches (3).');
                    } else if (data.session) {
                        setExamOverlay({ type: 'tab-switch', switchCount: data.session.tabSwitchCount });
                    }
                } catch (e) {
                    console.error('Error logging tab switch', e);
                }
            } else if (document.visibilityState === 'visible') {
                // Re-enter fullscreen whenever they come back
                enterFullscreen();
            }
        };

        // ── Fullscreen enforcement ──
        const handleFullscreenChange = async () => {
            if (!document.fullscreenElement) {
                setExamOverlay({ type: 'fullscreen' });
                try {
                    await sendFullscreenExit(resolvedExamId);
                } catch (e) {
                    console.error('Error logging fullscreen exit', e);
                }
            } else {
                // Back in fullscreen — dismiss any overlay
                setExamOverlay(null);
            }
        };

        // ── Window blur: catches Alt+Tab to another OS window (not just browser tabs) ──
        const handleWindowBlur = () => {
            // Only show the overlay — visibilitychange handles logging.
            // Use a small delay so we don't flicker on benign focus transfers (e.g. dev tools).
            setTimeout(() => {
                if (!document.hasFocus()) {
                    setExamOverlay(prev => prev ?? { type: 'tab-switch', switchCount: undefined });
                }
            }, 300);
        };

        // ── Keyboard shortcut blocking ──
        const handleKeyDown = (e: KeyboardEvent) => {
            const shouldBlock =
                // Tab switching
                (e.ctrlKey && e.key === 'Tab') ||
                (e.ctrlKey && e.shiftKey && e.key === 'Tab') ||
                // Close / new tab / new window
                (e.ctrlKey && (e.key === 'w' || e.key === 'W')) ||
                (e.ctrlKey && (e.key === 't' || e.key === 'T')) ||
                (e.ctrlKey && (e.key === 'n' || e.key === 'N')) ||
                // DevTools
                (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) ||
                e.key === 'F12' ||
                // Fullscreen toggle
                e.key === 'F11' ||
                // Close window (Windows/Linux)
                (e.altKey && e.key === 'F4');

            if (shouldBlock) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // ── Copy enforcement: log if > 20 chars ──
        const handleCopy = async (e: ClipboardEvent) => {
            const selected = window.getSelection()?.toString() || '';
            const length = selected.length;
            if (length > 20) {
                try {
                    await sendExamAlert(resolvedExamId, length, selected.substring(0, 200));
                    console.warn(`[Exam] Suspicious copy: ${length} chars logged`);
                } catch (err) {
                    console.error('Failed to log copy event', err);
                }
            }
            if (length > 50) {
                e.preventDefault();
                e.clipboardData?.setData('text/plain', '');
                console.warn('[Exam] Copy blocked: content exceeds 50 chars');
            }
        };

        // ── Paste enforcement: block if > 50 chars, log if > 20 chars ──
        const handlePaste = async (e: ClipboardEvent) => {
            const pastedText = e.clipboardData?.getData('text/plain') || '';
            const length = pastedText.length;

            if (length > 50) {
                e.preventDefault();
                try {
                    await sendExamAlert(resolvedExamId, length, pastedText.substring(0, 200));
                    console.warn(`[Exam] Paste BLOCKED: ${length} chars`);
                } catch (err) {
                    console.error('Failed to log paste block', err);
                }
                return;
            }

            if (length > 20) {
                try {
                    await sendExamAlert(resolvedExamId, length, pastedText.substring(0, 200));
                    console.warn(`[Exam] Paste logged: ${length} chars`);
                } catch (err) {
                    console.error('Failed to log paste', err);
                }
            }
        };

        // Check if currently blocked on mount
        getMyExamSession(resolvedExamId)
            .then(data => {
                if (data?.isBlocked) {
                    setRoomBlocked(true);
                    setRoomBlockReason(data.blockedReason || 'You are blocked from this exam.');
                }
            })
            .catch(console.error);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        // capture: true so we intercept before Monaco/other handlers
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('copy', handleCopy as unknown as EventListener);
        document.addEventListener('paste', handlePaste as unknown as EventListener);
        window.addEventListener('blur', handleWindowBlur);

        // First click triggers fullscreen (browser policy)
        document.body.addEventListener('click', enterFullscreen, { once: true });
        enterFullscreen();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('copy', handleCopy as unknown as EventListener);
            document.removeEventListener('paste', handlePaste as unknown as EventListener);
            window.removeEventListener('blur', handleWindowBlur);
            document.body.removeEventListener('click', enterFullscreen);
        };
    }, [isExamMode, resolvedExamId, roomBlocked]);


    // ── Room Type Validation Guard ──
    useEffect(() => {
        if (!roomId) return;

        // Enforce prefix-based access at the routing level
        if (isExamMode && !roomId.startsWith('EX-')) {
            setRoomBlocked(true);
            setRoomBlockReason('This is not a valid Exam room code. Exam codes start with EX-.');
            return;
        }
        if (!isExamMode && roomId.startsWith('EX-')) {
            setRoomBlocked(true);
            setRoomBlockReason('Cannot open an Exam room in Collaboration mode. Go to the Hub and select "Take an Exam".');
            return;
        }
    }, [roomId, isExamMode]);

    // Multi-terminal state
    const [terminals, setTerminals] = useState([{ id: 'term-1', label: 'Terminal 1' }]);
    const [activeTerminal, setActiveTerminal] = useState('term-1');
    const terminalCounter = useRef(1);

    // Upload state
    const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<{ type: 'uploading' | 'success' | 'error'; message: string } | null>(null);
    const uploadMenuRef = useRef<HTMLDivElement>(null);
    const zipInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Drag resize refs
    const isDraggingPanel = useRef(false);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);

    // Panel drag resize handlers
    const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingPanel.current = true;
        dragStartY.current = e.clientY;
        dragStartHeight.current = panelHeight;

        const handleMouseMove = (ev: MouseEvent) => {
            if (!isDraggingPanel.current) return;
            const delta = dragStartY.current - ev.clientY;
            const newHeight = Math.max(100, Math.min(600, dragStartHeight.current + delta));
            setPanelHeight(newHeight);
        };

        const handleMouseUp = () => {
            isDraggingPanel.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [panelHeight]);

    const addTerminal = useCallback(() => {
        terminalCounter.current += 1;
        const id = `term-${terminalCounter.current}`;
        setTerminals(prev => [...prev, { id, label: `Terminal ${terminalCounter.current}` }]);
        setActiveTerminal(id);
    }, []);

    const closeTerminal = useCallback((id: string) => {
        setTerminals(prev => {
            const next = prev.filter(t => t.id !== id);
            if (next.length === 0) {
                setPanelOpen(false);
                return prev;
            }
            if (activeTerminal === id) {
                setActiveTerminal(next[next.length - 1].id);
            }
            return next;
        });
    }, [activeTerminal]);

    // Load file tree from backend
    useEffect(() => {
        const loadFileTree = async () => {
            setLoading(true);
            setError('');
            try {
                // Initialize workspace if needed
                await initWorkspace(workspaceId);
                const tree = await getFileTree(workspaceId);
                // Map backend format to FileNode format
                const mapTree = (nodes: any[]): FileNode[] =>
                    nodes.map((n: any) => ({
                        name: n.name,
                        path: n.path,
                        type: n.type === 'directory' ? 'folder' : 'file',
                        children: n.children ? mapTree(n.children) : undefined,
                    }));
                setFiles(mapTree(tree));
            } catch (err: any) {
                console.error('Failed to load file tree:', err);
                setError(err.message || 'Failed to load files');
            } finally {
                setLoading(false);
            }
        };
        loadFileTree();
    }, [workspaceId]);

    // Load session data + extensions on mount
    useEffect(() => {
        const loadSession = async () => {
            // Load extensions registry first
            let extsList: ExtensionInfo[] = [];
            try {
                extsList = await getExtensions();
                setAllExtensions(extsList);
            } catch {
                // extensions endpoint may not be ready yet
            }

            // Load or auto-create session
            let session: SessionInfo | null = null;
            try {
                session = await getSession(workspaceId);
            } catch {
                // Session doesn't exist yet — auto-create one
                try {
                    session = await createSession(
                        `Session ${new Date().toLocaleDateString()}`,
                        workspaceId,
                        workspaceId,
                        username
                    );
                } catch {
                    // silent
                }
            }

            if (session) {
                setSessionData(session);
                applyThemeFromSession(session, extsList);

                // Restore previously open tabs
                if (session.openTabs && session.openTabs.length > 0) {
                    const restoredTabs: TabInfo[] = session.openTabs.map(path => ({
                        path,
                        name: path.split('/').pop() || path,
                        language: getLanguageFromFilename(path.split('/').pop() || ''),
                        isModified: false,
                    }));

                    // Load all tab contents from disk in parallel
                    await Promise.all(
                        session.openTabs.map(async (path) => {
                            try {
                                const content = await readFile(workspaceId, path);
                                fileContents.set(path, content);
                                lastSavedContent.set(path, content);
                            } catch {
                                fileContents.set(path, '');
                                lastSavedContent.set(path, '');
                            }
                        })
                    );

                    setTabs(restoredTabs);
                    const savedActive = session.activeTab && session.openTabs.includes(session.activeTab)
                        ? session.activeTab
                        : restoredTabs[0].path;
                    setActiveTab(savedActive);
                }
            }
        };
        loadSession();
    }, [workspaceId, username]);

    // Auto-save session state (tabs, active tab) every 10 seconds
    useEffect(() => {
        if (!sessionData) return;
        if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
        sessionSaveTimer.current = setTimeout(async () => {
            try {
                await saveSession(workspaceId, {
                    openTabs: tabs.map(t => t.path),
                    activeTab,
                });
            } catch {
                // silent
            }
        }, 10000);
        return () => {
            if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
        };
    }, [tabs, activeTab, workspaceId, sessionData]);

    // Save all open files the moment the page becomes hidden (tab switch, minimize, close)
    // This is a safety net on top of the 2s debounced auto-save
    useEffect(() => {
        const handleHide = () => {
            if (document.visibilityState !== 'hidden') return;
            tabs.forEach(tab => {
                const content = fileContents.get(tab.path);
                if (content !== undefined) {
                    saveFile(workspaceId, tab.path, content).catch(() => {});
                }
            });
        };
        document.addEventListener('visibilitychange', handleHide);
        return () => document.removeEventListener('visibilitychange', handleHide);
    }, [tabs, workspaceId]);

    // Apply theme from installed theme extensions — takes extensions list as param to avoid stale closure
    const applyThemeFromSession = useCallback((session: SessionInfo, extsList?: ExtensionInfo[]) => {
        const themeExt = session.extensions.find(e => e.extensionId.startsWith('theme-'));
        if (!themeExt) {
            // Reset to defaults when no theme is installed
            const root = document.documentElement;
            root.style.removeProperty('--bg-primary');
            root.style.removeProperty('--bg-secondary');
            root.style.removeProperty('--bg-elevated');
            root.style.removeProperty('--bg-active');
            root.style.removeProperty('--text-primary');
            root.style.removeProperty('--text-secondary');
            root.style.removeProperty('--text-muted');
            root.style.removeProperty('--accent-primary');
            root.style.removeProperty('--accent-secondary');
            root.style.removeProperty('--accent-error');
            root.style.removeProperty('--border-subtle');
            return;
        }
        // Use passed list or fall back to state
        const list = extsList || allExtensions;
        const ext = list.find(e => e.id === themeExt.extensionId);
        const config = ext?.config || themeExt.config;
        if (!config) return;
        const root = document.documentElement;
        if (config.bgPrimary) root.style.setProperty('--bg-primary', config.bgPrimary);
        if (config.bgSecondary) root.style.setProperty('--bg-secondary', config.bgSecondary);
        if (config.bgElevated) root.style.setProperty('--bg-elevated', config.bgElevated);
        if (config.bgActive) root.style.setProperty('--bg-active', config.bgActive);
        if (config.textPrimary) root.style.setProperty('--text-primary', config.textPrimary);
        if (config.textSecondary) root.style.setProperty('--text-secondary', config.textSecondary);
        if (config.textMuted) root.style.setProperty('--text-muted', config.textMuted);
        if (config.accentPrimary) root.style.setProperty('--accent-primary', config.accentPrimary);
        if (config.accentSecondary) root.style.setProperty('--accent-secondary', config.accentSecondary);
        if (config.accentError) root.style.setProperty('--accent-error', config.accentError);
        if (config.borderSubtle) root.style.setProperty('--border-subtle', config.borderSubtle);
    }, [allExtensions]);

    // Handle extension install/uninstall callback
    const handleExtensionChange = useCallback((updatedSession: SessionInfo) => {
        setSessionData(updatedSession);
        applyThemeFromSession(updatedSession);
    }, [applyThemeFromSession]);

    const refreshTree = useCallback(async () => {
        try {
            const tree = await getFileTree(workspaceId);
            const mapTree = (nodes: any[]): FileNode[] =>
                nodes.map((n: any) => ({
                    name: n.name,
                    path: n.path,
                    type: n.type === 'directory' ? 'folder' : 'file',
                    children: n.children ? mapTree(n.children) : undefined,
                }));
            setFiles(mapTree(tree));
        } catch (err) {
            console.error('Failed to refresh tree:', err);
        }
    }, [workspaceId]);

    const handleCreateFile = useCallback(async (name: string, isFolder: boolean) => {
        if (!name.trim()) return;
        try {
            const path = '/' + name.trim();
            await apiCreateFile(workspaceId, path, isFolder);
            await refreshTree();
            setCreatingFile(null);
            setNewFileName('');
            // Auto-open the new file
            if (!isFolder) {
                const lang = getLanguageFromFilename(name);
                setTabs(prev => [...prev, { path, name: name.trim(), language: lang }]);
                setActiveTab(path);
                fileContents.set(path, '');
            }
        } catch (err: any) {
            console.error('Failed to create:', err);
            setError(err.message);
            setTimeout(() => setError(''), 3000);
        }
    }, [workspaceId, refreshTree]);

    const handleNestedCreateFile = useCallback(async (parentPath: string, name: string, isFolder: boolean) => {
        if (!name.trim()) return;
        try {
            const fullPath = parentPath === '/' ? `/${name.trim()}` : `${parentPath}/${name.trim()}`;
            await apiCreateFile(workspaceId, fullPath, isFolder);
            await refreshTree();
            if (!isFolder) {
                const lang = getLanguageFromFilename(name);
                setTabs(prev => [...prev, { path: fullPath, name: name.trim(), language: lang }]);
                setActiveTab(fullPath);
                fileContents.set(fullPath, '');
            }
        } catch (err: any) {
            console.error('Failed to create:', err);
            setError(err.message);
            setTimeout(() => setError(''), 3000);
        }
    }, [workspaceId, refreshTree]);

    const handleDownloadFile = useCallback(async (path?: string) => {
        try {
            await downloadWorkspace(workspaceId, path);
        } catch (err: any) {
            setUploadStatus({ type: 'error', message: `✗ Download failed: ${err.message}` });
            setTimeout(() => setUploadStatus(null), 4000);
        }
    }, [workspaceId]);

    const handleMoveFile = useCallback(async (oldPath: string, newPath: string) => {
        try {
            await apiMoveFile(workspaceId, oldPath, newPath);
            await refreshTree();
            // Update tabs if the moved file was open
            setTabs(prev => prev.map(t => {
                if (t.path === oldPath || t.path.startsWith(oldPath + '/')) {
                    const relativePart = t.path.slice(oldPath.length);
                    const updatedPath = newPath + relativePart;
                    const updatedName = updatedPath.split('/').pop() || t.name;
                    // Move cached content
                    const cached = fileContents.get(t.path);
                    if (cached !== undefined) {
                        fileContents.delete(t.path);
                        fileContents.set(updatedPath, cached);
                    }
                    return { ...t, path: updatedPath, name: updatedName };
                }
                return t;
            }));
            setActiveTab(prev => {
                if (prev === oldPath) return newPath;
                if (prev.startsWith(oldPath + '/')) return newPath + prev.slice(oldPath.length);
                return prev;
            });
        } catch (err: any) {
            console.error('Failed to move:', err);
            setError(err.message);
            setTimeout(() => setError(''), 3000);
        }
    }, [workspaceId, refreshTree]);

    const handleDeleteFile = useCallback(async (path: string) => {
        try {
            await apiDeleteFile(workspaceId, path);
            await refreshTree();
            // Close tab if open
            setTabs(prev => prev.filter(t => t.path !== path && !t.path.startsWith(path + '/')));
            fileContents.delete(path);
        } catch (err: any) {
            console.error('Failed to delete:', err);
            setError(err.message);
            setTimeout(() => setError(''), 3000);
        }
    }, [workspaceId, refreshTree]);

    const handleRenameFile = useCallback(async (oldPath: string, newName: string) => {
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = parentDir ? `${parentDir}/${newName}` : `/${newName}`;
        await handleMoveFile(oldPath, newPath);
    }, [handleMoveFile]);

    // Close upload menu when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
                setUploadMenuOpen(false);
            }
        };
        if (uploadMenuOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [uploadMenuOpen]);

    const handleUploadZip = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setUploadMenuOpen(false);
        setUploadStatus({ type: 'uploading', message: 'Uploading ZIP...' });
        try {
            const result = await uploadZip(workspaceId, file);
            setUploadStatus({ type: 'success', message: `✓ ${result.uploaded} files extracted` });
            await refreshTree();
        } catch (err: any) {
            setUploadStatus({ type: 'error', message: `✗ ${err.message}` });
        } finally {
            setTimeout(() => setUploadStatus(null), 4000);
        }
    }, [workspaceId, refreshTree]);

    const handleUploadFolder = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        e.target.value = '';
        setUploadMenuOpen(false);
        setUploadStatus({ type: 'uploading', message: `Uploading ${files.length} files...` });
        try {
            const result = await uploadFolder(workspaceId, files);
            setUploadStatus({ type: 'success', message: `✓ ${result.uploaded} files uploaded` });
            await refreshTree();
        } catch (err: any) {
            setUploadStatus({ type: 'error', message: `✗ ${err.message}` });
        } finally {
            setTimeout(() => setUploadStatus(null), 4000);
        }
    }, [workspaceId, refreshTree]);

    // ---- Terminal file-system callbacks ----
    const flattenTree = useCallback((nodes: FileNode[], result: { name: string; path: string; type: string }[] = []) => {
        for (const n of nodes) {
            result.push({ name: n.name, path: n.path, type: n.type });
            if (n.children) flattenTree(n.children, result);
        }
        return result;
    }, []);

    const terminalCreateFile = useCallback(async (path: string, isFolder: boolean) => {
        await apiCreateFile(workspaceId, path, isFolder);
        await refreshTree();
    }, [workspaceId, refreshTree]);

    const terminalDeleteFile = useCallback(async (path: string) => {
        await apiDeleteFile(workspaceId, path);
        await refreshTree();
        setTabs(prev => prev.filter(t => t.path !== path && !t.path.startsWith(path + '/')));
        fileContents.delete(path);
    }, [workspaceId, refreshTree]);

    const terminalMoveFile = useCallback(async (oldPath: string, newPath: string) => {
        await apiMoveFile(workspaceId, oldPath, newPath);
        await refreshTree();
    }, [workspaceId, refreshTree]);

    const terminalReadFile = useCallback(async (path: string): Promise<string> => {
        const content = await readFile(workspaceId, path);
        return content;
    }, [workspaceId]);

    const terminalListFiles = useCallback(() => {
        return flattenTree(files);
    }, [files, flattenTree]);

    const handleFileSelect = useCallback(async (file: FileNode) => {
        if (file.type !== 'file') return;

        if (!tabs.find((t) => t.path === file.path)) {
            const lang = getLanguageFromFilename(file.name);
            setTabs((prev) => [...prev, { path: file.path, name: file.name, language: lang }]);
        }
        setActiveTab(file.path);

        // Load file content from backend if not cached
        if (!fileContents.has(file.path)) {
            try {
                const content = await readFile(workspaceId, file.path);
                fileContents.set(file.path, content);
                lastSavedContent.set(file.path, content);
            } catch (err: any) {
                console.error('Failed to read file:', err);
                fileContents.set(file.path, `// Error loading file: ${err.message}`);
            }
        }
    }, [tabs, workspaceId]);

    const handleTabClose = useCallback((path: string) => {
        setTabs((prev) => {
            const newTabs = prev.filter((t) => t.path !== path);
            if (activeTab === path && newTabs.length > 0) {
                setActiveTab(newTabs[newTabs.length - 1].path);
            } else if (newTabs.length === 0) {
                setActiveTab('');
            }
            return newTabs;
        });
    }, [activeTab]);

    const handleEditorChange = useCallback((value: string | undefined) => {
        if (activeTab && value !== undefined) {
            fileContents.set(activeTab, value);

            // Only dirty if content actually differs from what's on disk
            const isDirty = value !== lastSavedContent.get(activeTab);
            setTabs((prev) =>
                prev.map((t) => (t.path === activeTab ? { ...t, isModified: isDirty } : t))
            );

            if (!isDirty) return;

            // Auto-save 2s after last keystroke
            const tabToSave = activeTab;
            const wsToSave = workspaceId;
            if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
            autoSaveTimer.current = setTimeout(async () => {
                try {
                    await saveFile(wsToSave, tabToSave, value);
                    lastSavedContent.set(tabToSave, value);
                    setTabs((prev) =>
                        prev.map((t) => (t.path === tabToSave ? { ...t, isModified: false } : t))
                    );
                } catch {
                    // silent — Ctrl+S still works as manual fallback
                }
            }, 2000);
        }
    }, [activeTab, workspaceId]);

    // Save file to backend (Ctrl+S)
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (activeTab) {
                    const content = fileContents.get(activeTab);
                    if (content !== undefined) {
                        try {
                            await saveFile(workspaceId, activeTab, content);
                            lastSavedContent.set(activeTab, content);
                            setTabs((prev) =>
                                prev.map((t) => (t.path === activeTab ? { ...t, isModified: false } : t))
                            );
                        } catch (err: any) {
                            console.error('Failed to save file:', err);
                        }
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, workspaceId]);

    const toggleSidebar = (panel: SidebarPanel) => {
        if (activePanel === panel && sidebarVisible) {
            setSidebarVisible(false);
        } else {
            setActivePanel(panel);
            setSidebarVisible(true);
        }
    };

    const handleCopyRoomLink = () => {
        const link = `${window.location.origin}/room/${roomId}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const activeFileContent = activeTab ? fileContents.get(activeTab) || '' : '';
    const activeLanguage = tabs.find((t) => t.path === activeTab)?.language || 'plaintext';

    const collabRoomId = roomId;

    // ── Room type mismatch / exam block screen ──
    if (roomBlocked) {
        return (
            <div className="w-full h-screen flex items-center justify-center p-8 bg-black relative overflow-hidden">
                <div className="absolute top-[-15%] left-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl p-10 text-center shadow-2xl"
                    initial={{ opacity: 0, scale: 0.95, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="text-5xl mb-5"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    >
                        ⛔
                    </motion.div>
                    <h1 className="text-2xl font-black text-red-400 mb-3 tracking-tight">Access Denied</h1>
                    <p className="text-white/60 text-sm leading-relaxed mb-8">
                        {roomBlockReason}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white font-semibold text-sm transition-all"
                    >
                        Return to Hub
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="editor-root" data-theme="dark" style={{ width: '100%', height: '100%', position: 'relative' }}>

            {/* Exam timer bar */}
            {isExamMode && timeLeft && (
                <div style={{
                    background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
                    color: 'white',
                    fontWeight: '700',
                    textAlign: 'center',
                    padding: '5px 16px',
                    fontSize: '13px',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                }}>
                    <span style={{ opacity: 0.8 }}>🔒 EXAM IN PROGRESS</span>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <span>Time Remaining: {timeLeft}</span>
                </div>
            )}

            <div className={`ide-layout${!sidebarVisible ? ' sidebar-collapsed' : ''}`} style={{ height: isExamMode && timeLeft ? 'calc(100% - 32px)' : '100%' }}>
                {/* Activity Bar */}
                <div className="activity-bar">
                    <div
                        className={`activity-bar-icon${activePanel === 'explorer' && sidebarVisible ? ' active' : ''}`}
                        onClick={() => toggleSidebar('explorer')}
                        title="Explorer"
                    >
                        <Files size={24} />
                    </div>
                    <div
                        className={`activity-bar-icon${activePanel === 'search' && sidebarVisible ? ' active' : ''}`}
                        onClick={() => toggleSidebar('search')}
                        title="Search"
                    >
                        <Search size={24} />
                    </div>
                    <div
                        className={`activity-bar-icon${activePanel === 'git' && sidebarVisible ? ' active' : ''}`}
                        onClick={() => toggleSidebar('git')}
                        title="Source Control"
                    >
                        <GitBranch size={24} />
                    </div>

                    {!isExamMode && (
                        <div
                            className={`activity-bar-icon${activePanel === 'users' && sidebarVisible ? ' active' : ''}`}
                            onClick={() => toggleSidebar('users')}
                            title="Collaborators"
                        >
                            <Users size={24} />
                        </div>
                    )}

                    <div
                        className={`activity-bar-icon${activePanel === 'extensions' && sidebarVisible ? ' active' : ''}`}
                        onClick={() => toggleSidebar('extensions')}
                        title="Extensions"
                    >
                        <Puzzle size={24} />
                    </div>
                    <div className="activity-bar-bottom">
                        <div className="activity-bar-icon" title="Settings">
                            <Settings size={24} />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                {sidebarVisible && (
                    <div className="sidebar">
                        <div className="sidebar-header">
                            {activePanel === 'explorer' && 'Explorer'}
                            {activePanel === 'search' && 'Search'}
                            {activePanel === 'git' && 'Source Control'}
                            {activePanel === 'users' && 'Collaborators'}
                            {activePanel === 'extensions' && 'Extensions'}
                            {isExamMode && (
                                <div className="sidebar-header-actions" style={{ color: 'red', fontWeight: 'bold' }}>
                                    EXAM MODE
                                </div>
                            )}
                            {roomId && !isExamMode && (
                                <div className="sidebar-header-actions">
                                    <button onClick={handleCopyRoomLink} title="Copy room link">
                                        {copied ? <span style={{ fontSize: 10 }}>Copied!</span> : <Share2 size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="sidebar-content">
                            {activePanel === 'explorer' && (
                                loading ? (
                                    <div style={{ padding: '12px' }}>
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0.5 }}
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                                                style={{
                                                    height: 16,
                                                    marginBottom: 10,
                                                    borderRadius: 2,
                                                    background: 'var(--bg-active)',
                                                    width: `${Math.max(40, 100 - i * 10)}%`
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : error ? (
                                    <div style={{ padding: '12px', color: 'var(--accent-error)', fontSize: 12 }}>
                                        {error}
                                    </div>
                                ) : (
                                    <>
                                        <div className="explorer-actions">
                                            <button
                                                className="explorer-action-btn"
                                                onClick={() => { setCreatingFile('file'); setNewFileName(''); }}
                                                title="New File"
                                            >
                                                <FilePlus2 size={14} />
                                            </button>
                                            <button
                                                className="explorer-action-btn"
                                                onClick={() => { setCreatingFile('folder'); setNewFileName(''); }}
                                                title="New Folder"
                                            >
                                                <FolderPlus size={14} />
                                            </button>
                                            {/* Upload button */}

                                            <button
                                                className="explorer-action-btn"
                                                onClick={() => handleDownloadFile()}
                                                title="Download Workspace"
                                            >
                                                <Download size={14} />
                                            </button>
                                            <div className="upload-menu-wrapper" ref={uploadMenuRef}>
                                                <button
                                                    className="explorer-action-btn"
                                                    onClick={() => setUploadMenuOpen(v => !v)}
                                                    title="Upload Folder or ZIP"
                                                >
                                                    <Upload size={14} />
                                                </button>
                                                {uploadMenuOpen && (
                                                    <div className="upload-dropdown">
                                                        <button
                                                            className="upload-dropdown-item"
                                                            onClick={() => { setUploadMenuOpen(false); folderInputRef.current?.click(); }}
                                                        >
                                                            <FolderArchive size={13} />
                                                            Upload Folder
                                                        </button>
                                                        <button
                                                            className="upload-dropdown-item"
                                                            onClick={() => { setUploadMenuOpen(false); zipInputRef.current?.click(); }}
                                                        >
                                                            <Upload size={13} />
                                                            Upload ZIP
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Hidden file inputs */}
                                            <input
                                                ref={zipInputRef}
                                                type="file"
                                                accept=".zip"
                                                style={{ display: 'none' }}
                                                onChange={handleUploadZip}
                                            />
                                            <input
                                                ref={folderInputRef}
                                                type="file"
                                                style={{ display: 'none' }}
                                                // @ts-ignore – webkitdirectory is non-standard but works in all modern browsers
                                                webkitdirectory=""
                                                multiple
                                                onChange={handleUploadFolder}
                                            />
                                        </div>
                                        {/* Upload status bar */}
                                        {uploadStatus && (
                                            <div className={`upload-status upload-status--${uploadStatus.type}`}>
                                                {uploadStatus.type === 'uploading' && (
                                                    <span className="upload-spinner" />
                                                )}
                                                {uploadStatus.message}
                                            </div>
                                        )}
                                        {creatingFile && (
                                            <form
                                                className="new-file-form"
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleCreateFile(newFileName, creatingFile === 'folder');
                                                }}
                                            >
                                                <input
                                                    autoFocus
                                                    className="new-file-input"
                                                    placeholder={creatingFile === 'folder' ? 'folder name...' : 'filename.ext...'}
                                                    value={newFileName}
                                                    onChange={(e) => setNewFileName(e.target.value)}
                                                    onBlur={() => { setCreatingFile(null); setNewFileName(''); }}
                                                    onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingFile(null); setNewFileName(''); } }}
                                                />
                                            </form>
                                        )}
                                        <FileExplorer
                                            files={files}
                                            onFileSelect={handleFileSelect}
                                            selectedPath={activeTab}
                                            onMoveFile={handleMoveFile}
                                            onCreateFile={handleNestedCreateFile}
                                            onDeleteFile={handleDeleteFile}
                                            onRenameFile={handleRenameFile}
                                            onDownloadFile={handleDownloadFile}
                                        />
                                    </>
                                )
                            )}
                            {activePanel === 'search' && (
                                <div style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                    Search coming soon...
                                </div>
                            )}
                            {activePanel === 'git' && (
                                <GitPanel
                                    workspaceId={workspaceId}
                                    username={username}
                                    onRefreshTree={refreshTree}
                                />
                            )}
                            {activePanel === 'extensions' && (
                                <ExtensionPanel
                                    sessionId={workspaceId}
                                    installedExtensions={sessionData?.extensions.map(e => e.extensionId) || []}
                                    onExtensionChange={handleExtensionChange}
                                />
                            )}
                            {activePanel === 'users' && (
                                <>
                                    {roomId && (
                                        <div className="room-info-panel">
                                            <div className="room-info-row">
                                                <span className="room-info-label">Room ID</span>
                                                <code className="room-info-value">{roomId}</code>
                                                <button className="room-info-copy" onClick={handleCopyRoomLink}>
                                                    <Copy size={12} />
                                                </button>
                                            </div>
                                            <div className="room-info-row">
                                                <span className="room-info-label">You</span>
                                                <span className="room-info-value">{username}</span>
                                            </div>
                                        </div>
                                    )}
                                    <UserPresence provider={provider} currentUser={username} />
                                    {!roomId && (
                                        <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: 12 }}>
                                            <p>Not in a room. <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: 'var(--accent-primary)' }}>Create or join a room</a> to collaborate.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Main Editor Area */}
                <div className="main-area">
                    <div className="editor-topbar">
                        <EditorTabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabSelect={setActiveTab}
                            onTabClose={handleTabClose}
                        />
                        <div className="user-badge">
                            <div className="user-badge-avatar">
                                {username.charAt(0).toUpperCase()}
                            </div>
                            <span className="user-badge-name">{username}</span>
                        </div>
                    </div>
                    <div className="editor-content">
                        {activeTab ? (
                            <CodeEditor
                                key={activeTab}
                                content={activeFileContent}
                                language={activeLanguage}
                                roomId={collabRoomId}
                                examId={resolvedExamId || undefined}
                                username={username}
                                onChange={handleEditorChange}
                                onCursorChange={(line, col) => setCursorPos({ line, column: col })}
                                onProviderReady={setProvider}
                                onAlert={setEditorAlert}
                            />
                        ) : (
                            <div className="editor-welcome">
                                <h2>Colab Code Editor</h2>
                                {roomId ? (
                                    <>
                                        <p>Room: <code style={{ color: 'var(--accent-primary)' }}>{roomId}</code></p>
                                        <p>Open a file from the Explorer to start editing</p>
                                    </>
                                ) : (
                                    <p>Open a file from the Explorer to start editing</p>
                                )}
                                <p>
                                    <kbd>Ctrl</kbd> + <kbd>S</kbd> Save File
                                </p>
                                <p>
                                    <kbd>Ctrl</kbd> + <kbd>`</kbd> Toggle Terminal
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Panel */}
                    {panelOpen && (
                        <div className="bottom-panel" style={{ height: panelHeight }}>
                            {/* Drag resize handle */}
                            <div
                                className="panel-resize-handle"
                                onMouseDown={handlePanelDragStart}
                            />
                            <div className="panel-header">
                                <div className="panel-terminal-tabs">
                                    {terminals.map(t => (
                                        <div
                                            key={t.id}
                                            className={`panel-terminal-tab${t.id === activeTerminal ? ' active' : ''}`}
                                            onClick={() => setActiveTerminal(t.id)}
                                        >
                                            <span>{t.label}</span>
                                            <button
                                                className="panel-terminal-tab-close"
                                                onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                                                title="Close Terminal"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="panel-terminal-add"
                                        onClick={addTerminal}
                                        title="New Terminal"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                                <button
                                    className="panel-toggle"
                                    onClick={() => setPanelOpen(false)}
                                    title="Close Panel"
                                >
                                    <PanelBottomClose size={16} />
                                </button>
                            </div>
                            <div className="panel-content">
                                {terminals.map(t => (
                                    <div
                                        key={t.id}
                                        style={{ display: t.id === activeTerminal ? 'contents' : 'none' }}
                                    >
                                        <Terminal
                                            id={t.id}
                                            examId={isExamMode ? resolvedExamId || undefined : undefined}
                                            activeFile={activeTab}
                                            activeCode={activeFileContent}
                                            activeLanguage={activeLanguage}
                                            onCreateFile={terminalCreateFile}
                                            onDeleteFile={terminalDeleteFile}
                                            onMoveFile={terminalMoveFile}
                                            onReadFile={terminalReadFile}
                                            onListFiles={terminalListFiles}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!panelOpen && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 'var(--status-bar-height)',
                                right: 8,
                                zIndex: 5,
                            }}
                        >
                            <button
                                className="panel-toggle"
                                onClick={() => setPanelOpen(true)}
                                title="Open Terminal"
                                style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)' }}
                            >
                                <PanelBottomOpen size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <StatusBar
                    language={activeLanguage}
                    line={cursorPos.line}
                    column={cursorPos.column}
                    branch="main"
                    connectedUsers={1}
                />
            </div>

            {/* ── Exam anti-cheat overlay ── */}
            <AnimatePresence>
                {isExamMode && examOverlay && (
                    <motion.div
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                            className={`max-w-md w-full bg-white/5 backdrop-blur-2xl rounded-2xl p-8 text-center shadow-2xl ${
                                examOverlay.type === 'fullscreen'
                                    ? 'border border-red-500/30'
                                    : 'border border-orange-500/30'
                            }`}
                        >
                            {examOverlay.type === 'fullscreen' ? (
                                <>
                                    <div className="text-5xl mb-5">🔒</div>
                                    <h2 className="text-xl font-black text-red-400 mb-3 tracking-tight">
                                        Fullscreen Required
                                    </h2>
                                    <p className="text-white/60 text-sm leading-relaxed mb-2">
                                        You exited fullscreen mode. The exam must be taken in fullscreen at all times.
                                    </p>
                                    <p className="text-red-400/80 text-xs font-bold mb-7">
                                        This incident has been logged.
                                    </p>
                                    <button
                                        onClick={() => {
                                            document.documentElement.requestFullscreen()
                                                .then(() => setExamOverlay(null))
                                                .catch(() => {});
                                        }}
                                        className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white font-semibold text-sm transition-all"
                                    >
                                        Return to Fullscreen
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="text-5xl mb-5">⚠️</div>
                                    <h2 className="text-xl font-black text-orange-400 mb-3 tracking-tight">
                                        Tab Switch Detected
                                    </h2>
                                    <p className="text-white/60 text-sm leading-relaxed mb-2">
                                        You switched away from the exam window.
                                    </p>
                                    {examOverlay.switchCount !== undefined && (
                                        <p className="text-orange-400 text-sm font-bold mb-7">
                                            {examOverlay.switchCount}/3 violations — blocked after 3.
                                        </p>
                                    )}
                                    <button
                                        onClick={() => {
                                            setExamOverlay(null);
                                            document.documentElement.requestFullscreen().catch(() => {});
                                        }}
                                        className="w-full py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-white font-semibold text-sm transition-all"
                                    >
                                        Return to Exam
                                    </button>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Editor alert (copy/paste violation) ── */}
            <Modal
                isOpen={!!editorAlert}
                title="Exam Restriction"
                icon="🚫"
                actions={[{ label: 'Dismiss', variant: 'primary', onClick: () => setEditorAlert(null) }]}
                onClose={() => setEditorAlert(null)}
            >
                {editorAlert}
            </Modal>
        </div>
    );
}
