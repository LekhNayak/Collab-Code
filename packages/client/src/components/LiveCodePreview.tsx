import { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from '../collab/monacoBinding';
import { getLanguageFromFilename } from './Editor';
import { WS_BASE } from '../config';

interface LiveCodePreviewProps {
    roomName: string;                // WebSocket room path
    params: Record<string, string>;  // monitor mode and ids; the auth token is added here
    followUserId: string;            // shows the file this user's editor has open
    onConnectedChange?: (connected: boolean) => void;
    onViewingFileChange?: (path: string | null) => void;
    fontSize?: number;
}

// Read-only, live view of another user's code, following whichever file they have open
// (their editor publishes `activeFile` through Yjs awareness). Used by the exam and contest monitors.
export default function LiveCodePreview({ roomName, params, followUserId, onConnectedChange, onViewingFileChange, fontSize = 12 }: LiveCodePreviewProps) {
    const cleanupRef = useRef<(() => void) | null>(null);
    const callbacks = useRef({ onConnectedChange, onViewingFileChange });
    useEffect(() => {
        callbacks.current = { onConnectedChange, onViewingFileChange };
    });

    useEffect(() => () => cleanupRef.current?.(), []);

    const handleMount: OnMount = (editor, monaco) => {
        const doc = new Y.Doc();
        const token = localStorage.getItem('token') || '';
        const provider = new WebsocketProvider(WS_BASE, roomName, doc, {
            params: { token, ...params },
            disableBc: true,
        });
        provider.on('status', (event: { status: string }) => {
            callbacks.current.onConnectedChange?.(event.status === 'connected');
        });
        editor.updateOptions({ readOnly: true });

        const files = doc.getMap<Y.Text>('files');
        let current: { ytext: Y.Text; model: Monaco.editor.ITextModel } | null = null;
        const followedFile = (): string | null => {
            for (const [clientId, state] of provider.awareness.getStates()) {
                if (clientId !== doc.clientID && state.user?.id === followUserId && state.activeFile) return state.activeFile;
            }
            return null;
        };
        const follow = () => {
            const activeFile = followedFile();
            const ytext = activeFile ? files.get(activeFile) ?? null : null;
            if (current?.ytext === ytext) return;

            current?.model.dispose(); // also destroys its binding
            current = null;
            callbacks.current.onViewingFileChange?.(ytext ? activeFile : null);
            if (!activeFile || !ytext) {
                editor.setModel(null);
                return;
            }
            const uri = monaco.Uri.from({ scheme: 'live', authority: followUserId, path: activeFile });
            monaco.editor.getModel(uri)?.dispose();
            const model = monaco.editor.createModel(ytext.toString(), getLanguageFromFilename(activeFile), uri);
            model.setEOL(monaco.editor.EndOfLineSequence.LF);
            new MonacoBinding(monaco, ytext, model, editor, provider.awareness, { shareSelection: false });
            editor.setModel(model);
            current = { ytext, model };
        };

        // Drop the wrapper's placeholder model
        const placeholder = editor.getModel();
        editor.setModel(null);
        placeholder?.dispose();

        provider.awareness.on('change', follow);
        files.observe(follow);
        cleanupRef.current = () => {
            provider.awareness.off('change', follow);
            files.unobserve(follow);
            current?.model.dispose();
            provider.destroy();
            doc.destroy();
        };
    };

    return (
        <Editor
            height="100%"
            theme="vs-dark"
            keepCurrentModel
            onMount={handleMount}
            options={{
                minimap: { enabled: false },
                fontSize,
                scrollBeyondLastLine: false,
                padding: { top: 10 },
                readOnly: true,
            }}
        />
    );
}
