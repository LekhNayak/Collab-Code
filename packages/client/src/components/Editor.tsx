import { useEffect, useRef, useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { sendExamAlert } from '../api';

interface CodeEditorProps {
    content: string;
    language: string;
    roomId?: string;
    examId?: string; // resolved exam UUID for alert API calls
    username?: string;
    onChange?: (value: string | undefined) => void;
    onCursorChange?: (line: number, column: number) => void;
    onProviderReady?: (provider: WebsocketProvider | null) => void;
}

const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    sh: 'shell',
    bash: 'shell',
    env: 'plaintext',
    gitignore: 'plaintext',
    prisma: 'plaintext',
};

export function getLanguageFromFilename(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return languageMap[ext] || languageMap[filename.toLowerCase()] || 'plaintext';
}

// Random color for user cursor
function getRandomColor() {
    const colors = [
        '#f44747', '#dcdcaa', '#4ec9b0', '#569cd6', '#c586c0',
        '#ce9178', '#9cdcfe', '#d7ba7d', '#608b4e', '#d16969',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

export default function CodeEditor({
    content,
    language,
    roomId,
    examId,
    username = 'Anonymous',
    onChange,
    onCursorChange,
    onProviderReady,
}: CodeEditorProps) {
    const providerRef = useRef<WebsocketProvider | null>(null);
    const docRef = useRef<Y.Doc | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);

    // Cleanup collaboration on unmount or room change
    useEffect(() => {
        return () => {
            bindingRef.current?.destroy();
            providerRef.current?.destroy();
            docRef.current?.destroy();
            bindingRef.current = null;
            providerRef.current = null;
            docRef.current = null;
            onProviderReady?.(null);
            // Clean up injected cursor label styles
            const existingStyle = document.getElementById(`cursor-labels-${roomId}`);
            if (existingStyle) existingStyle.remove();
        };
    }, [roomId]);

    // Exam mode copy/paste restrictions
    useEffect(() => {
        if (!roomId?.startsWith('EX-') || !examId) return;

        const handleCopy = (e: ClipboardEvent) => {
            const selection = window.getSelection()?.toString() || '';
            if (selection.length > 50) {
                e.preventDefault();
                alert('Copy limit exceeded! You cannot copy more than 50 characters in exam mode.');
                return;
            }
            if (selection.length > 20) {
                sendExamAlert(examId, selection.length, `COPY: ${selection}`).catch(() => {});
            }
        };

        const handlePaste = (e: ClipboardEvent) => {
            const text = e.clipboardData?.getData('text/plain') || '';
            if (text.length > 50) {
                e.preventDefault();
                alert('Paste limit exceeded! You cannot paste more than 50 characters in exam mode.');
                return;
            }
            if (text.length > 20) {
                sendExamAlert(examId, text.length, `PASTE: ${text}`).catch(() => {});
            }
        };

        document.addEventListener('copy', handleCopy, true);
        document.addEventListener('paste', handlePaste, true);

        return () => {
            document.removeEventListener('copy', handleCopy, true);
            document.removeEventListener('paste', handlePaste, true);
        };
    }, [roomId, examId]);

    const handleMount: OnMount = useCallback((editor, _monaco) => {
        // Track cursor position
        editor.onDidChangeCursorPosition((e) => {
            onCursorChange?.(e.position.lineNumber, e.position.column);
        });

        // Setup collaboration if roomId is provided
        if (roomId) {
            try {
                const doc = new Y.Doc();
                docRef.current = doc;

                const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
                const token = localStorage.getItem('token') || '';
                const wsProvider = new WebsocketProvider(wsUrl, roomId, doc, {
                    params: token ? { token } : {}
                });
                providerRef.current = wsProvider;

                const type = doc.getText('monaco');

                // Wait for sync in ALL modes before touching the Yjs document.
                // This prevents race conditions where local writes conflict with remote state.
                wsProvider.on('sync', (isSynced: boolean) => {
                    if (!isSynced) return;

                    if (roomId.startsWith('EX-')) {
                        // Exam mode: push the current file content into the Yjs doc
                        // so the admin monitor can see what the student is editing.
                        if (type.length > 0) {
                            type.delete(0, type.length);
                        }
                        if (content) {
                            type.insert(0, content);
                        }
                    } else {
                        // Collab mode: only populate if the Yjs doc is empty
                        // (first user to open a newly imported file)
                        if (type.length === 0 && content) {
                            type.insert(0, content);
                        }
                    }
                });

                const binding = new MonacoBinding(
                    type,
                    editor.getModel()!,
                    new Set([editor]),
                    wsProvider.awareness
                );
                bindingRef.current = binding;

                // Set user presence
                const color = getRandomColor();
                wsProvider.awareness.setLocalStateField('user', {
                    name: username,
                    color,
                });

                // Dynamic cursor labels: inject CSS with usernames
                const styleEl = document.createElement('style');
                styleEl.id = `cursor-labels-${roomId}`;
                document.head.appendChild(styleEl);

                const updateCursorLabels = () => {
                    const states = wsProvider.awareness.getStates();
                    let css = '';
                    states.forEach((state, clientId) => {
                        if (clientId === wsProvider.awareness.clientID) return;
                        const user = state.user;
                        if (!user) return;
                        const idx = clientId % 10;
                        const uColor = user.color || 'orange';
                        const name = user.name || 'Anonymous';
                        // Escape CSS content value
                        const safeName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                        css += `
                      .yRemoteSelectionHead-${idx} {
                        border-color: ${uColor} !important;
                      }
                      .yRemoteSelectionHead-${idx}::after {
                        content: "${safeName}";
                        background: ${uColor};
                        opacity: 1;
                      }
                      .yRemoteSelection-${idx} {
                        background-color: ${uColor}33 !important;
                      }
                    `;
                    });
                    styleEl.textContent = css;
                };

                wsProvider.awareness.on('change', updateCursorLabels);
                updateCursorLabels();

                onProviderReady?.(wsProvider);
                console.log(`[Collab] Connected to room: ${roomId} as ${username}`);
            } catch (err) {
                console.error('[Collab] Failed to setup collaboration:', err);
            }
        }
    }, [roomId, username, onCursorChange, onProviderReady]);

    return (
        <Editor
            height="100%"
            language={language}
            value={roomId ? undefined : content}
            defaultValue={roomId ? content : undefined}
            theme="vs-dark"
            onChange={onChange}
            onMount={handleMount}
            loading={
                <div style={{ color: '#969696', padding: 20, fontFamily: 'var(--font-mono)' }}>
                    Loading editor...
                </div>
            }
            options={{
                fontSize: 14,
                fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'off',
                tabSize: 2,
                renderWhitespace: 'selection',
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                bracketPairColorization: { enabled: true },
                padding: { top: 8 },
                automaticLayout: true,
            }}
        />
    );
}
