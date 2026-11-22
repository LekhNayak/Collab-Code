import { useEffect, useReducer } from 'react';
import type * as Monaco from 'monaco-editor';
import { TAB_FOCUS_SHORTCUT } from '../monacoSetup';

// While the editor has focus, a small note in its corner says how to make Tab leave it, so a keyboard user is never
// stuck inside the editor (WCAG 2.1.2). Screen readers get the same through the editor's accessible name, and Monaco
// announces the new mode itself when it is switched. (Monaco keeps that mode internally, so the note doesn't show it.)
export default function EditorKeyboardHint({ editor }: { editor: Monaco.editor.IStandaloneCodeEditor | null }) {
    // The editor owns the focus; re-render when it moves in or out
    const [, refresh] = useReducer((n: number) => n + 1, 0);

    useEffect(() => {
        if (!editor) return;
        const subs = [editor.onDidFocusEditorText(refresh), editor.onDidBlurEditorText(refresh)];
        return () => subs.forEach(s => s.dispose());
    }, [editor]);

    if (!editor || !editor.hasTextFocus()) return null;
    return (
        <div className="editor-kbd-hint" aria-hidden>
            <kbd>{TAB_FOCUS_SHORTCUT}</kbd> switches Tab between indenting and moving focus
        </div>
    );
}
