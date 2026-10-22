import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import type { WebsocketProvider } from 'y-websocket';
import { sendExamAlert } from '../api';
import { MonacoBinding } from '../collab/monacoBinding';
import '../monacoSetup';

interface CodeEditorProps {
    path: string;                  // active file
    language: string;
    ytext: Y.Text | null;          // the active file's shared text; null while it is loading
    openPaths: string[];           // models are kept for open tabs and disposed when a tab closes
    awareness: WebsocketProvider['awareness'] | null;
    roomId?: string;
    examId?: string; // resolved exam UUID for alert API calls
    onCursorChange?: (line: number, column: number) => void;
    onAlert?: (message: string) => void;
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

interface OpenModel {
    ytext: Y.Text;
    model: Monaco.editor.ITextModel;
    binding: MonacoBinding;
}

// A single Monaco instance for the whole IDE. Each open tab gets its own model bound to its
// shared text, so switching tabs is just editor.setModel() — no remount, no reconnect — and
// background tabs keep receiving collaborators' edits.
export default function CodeEditor({
    path,
    language,
    ytext,
    openPaths,
    awareness,
    roomId,
    examId,
    onCursorChange,
    onAlert,
}: CodeEditorProps) {
    const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof Monaco | null>(null);
    const [ready, setReady] = useState(false);
    const models = useRef(new Map<string, OpenModel>());
    const viewStates = useRef(new Map<string, Monaco.editor.ICodeEditorViewState | null>());
    const shownPath = useRef('');
    const cursorCallback = useRef(onCursorChange);
    useEffect(() => {
        cursorCallback.current = onCursorChange;
    });

    const disposeModel = (p: string) => {
        const entry = models.current.get(p);
        if (!entry) return;
        if (editorRef.current?.getModel() === entry.model) editorRef.current.setModel(null);
        entry.model.dispose(); // also destroys the binding
        models.current.delete(p);
    };

    // Exam mode copy/paste restrictions
    useEffect(() => {
        if (!roomId?.startsWith('EX-') || !examId) return;

        const handleCopy = (e: ClipboardEvent) => {
            const selection = window.getSelection()?.toString() || '';
            if (selection.length > 50) {
                e.preventDefault();
                onAlert?.('Copy limit exceeded! You cannot copy more than 50 characters in exam mode.');
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
                onAlert?.('Paste limit exceeded! You cannot paste more than 50 characters in exam mode.');
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
    }, [roomId, examId, onAlert]);

    // Dynamic cursor labels: inject CSS with collaborators' names and colors
    useEffect(() => {
        if (!awareness) return;
        const styleEl = document.createElement('style');
        document.head.appendChild(styleEl);

        const updateCursorLabels = () => {
            let css = '';
            awareness.getStates().forEach((state, clientId) => {
                if (clientId === awareness.clientID) return;
                const user = state.user;
                if (!user) return;
                const uColor = user.color || '#f44747';
                const name = user.name || 'Anonymous';
                const safeName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                css += `
                  .yRemoteSelectionHead-${clientId} {
                    position: relative;
                    border-left: 2px solid ${uColor} !important;
                    border-top: 2px solid ${uColor} !important;
                    margin-left: -1px;
                  }
                  .yRemoteSelectionHead-${clientId}::after {
                    content: "${safeName}";
                    position: absolute;
                    top: -18px;
                    left: -1px;
                    background: ${uColor};
                    color: #fff;
                    font-size: 10px;
                    font-weight: 700;
                    font-family: system-ui, sans-serif;
                    padding: 1px 6px;
                    border-radius: 3px 3px 3px 0;
                    white-space: nowrap;
                    pointer-events: none;
                    line-height: 16px;
                    z-index: 100;
                  }
                  .yRemoteSelection-${clientId} {
                    background-color: ${uColor}33 !important;
                  }
                `;
            });
            styleEl.textContent = css;
        };

        awareness.on('change', updateCursorLabels);
        updateCursorLabels();
        return () => {
            awareness.off('change', updateCursorLabels);
            styleEl.remove();
        };
    }, [awareness]);

    // Show the active file: reuse its model if the tab was opened before, otherwise create one
    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!ready || !editor || !monaco) return;

        if (shownPath.current && editor.getModel()) {
            viewStates.current.set(shownPath.current, editor.saveViewState());
        }

        let entry = path ? models.current.get(path) : undefined;
        if (entry && entry.ytext !== ytext) {
            // The file was reloaded into a new shared text (e.g. after being deleted and recreated)
            disposeModel(path);
            entry = undefined;
        }

        if (!path || !ytext) {
            editor.setModel(null);
            shownPath.current = '';
        } else {
            if (!entry) {
                const uri = monaco.Uri.from({ scheme: 'file', path });
                monaco.editor.getModel(uri)?.dispose();
                const model = monaco.editor.createModel(ytext.toString(), language, uri);
                // The shared text only ever contains "\n" (the server normalizes line endings);
                // Monaco would otherwise default to CRLF on Windows and shift every offset
                model.setEOL(monaco.editor.EndOfLineSequence.LF);
                entry = { ytext, model, binding: new MonacoBinding(monaco, ytext, model, editor, awareness) };
                models.current.set(path, entry);
            }
            if (entry.model.getLanguageId() !== language) {
                monaco.editor.setModelLanguage(entry.model, language);
            }
            if (editor.getModel() !== entry.model) {
                editor.setModel(entry.model);
                const viewState = viewStates.current.get(path);
                if (viewState) editor.restoreViewState(viewState);
                editor.focus();
            }
            entry.binding.rerender();
            entry.binding.publishSelection();
            shownPath.current = path;
        }
        awareness?.setLocalStateField('activeFile', path || null);
    }, [ready, path, ytext, language, awareness]);

    // Dispose models of closed tabs
    useEffect(() => {
        const open = new Set(openPaths);
        [...models.current.keys()].forEach(p => {
            if (!open.has(p)) {
                disposeModel(p);
                viewStates.current.delete(p);
            }
        });
    }, [openPaths]);

    // Dispose everything on unmount
    useEffect(() => () => {
        [...models.current.keys()].forEach(disposeModel);
    }, []);

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        editor.onDidChangeCursorPosition((e) => {
            cursorCallback.current?.(e.position.lineNumber, e.position.column);
        });
        // Drop the placeholder model the wrapper creates; every file gets its own model above
        const placeholder = editor.getModel();
        editor.setModel(null);
        placeholder?.dispose();
        setReady(true);
    };

    return (
        <Editor
            height="100%"
            theme="vs-dark"
            keepCurrentModel
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
                // Never let Monaco rewrite a file's line terminators on open (that would mark it unsaved)
                unusualLineTerminators: 'off',
            }}
        />
    );
}
