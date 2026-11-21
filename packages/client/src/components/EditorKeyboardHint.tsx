import { useEffect, useReducer } from 'react';
import type * as Monaco from 'monaco-editor';
import { TAB_FOCUS_SHORTCUT } from '../monacoSetup';

// While the editor has focus, a small note in its corner says what Tab does and how to switch it, so a keyboard user
// is never stuck inside the editor (WCAG 2.1.2). Screen readers get the same through the editor's accessible name.
export default function EditorKeyboardHint({ editor, monaco }: { editor: Monaco.editor.IStandaloneCodeEditor | null; monaco: typeof Monaco | null }) {
    // The editor owns both facts (focus, and Monaco's global "Tab moves focus" mode); re-render when either changes
    const [, refresh] = useReducer((n: number) => n + 1, 0);

    useEffect(() => {
        if (!editor || !monaco) return;
        const option = monaco.editor.EditorOption.tabFocusMode;
        const subs = [
            editor.onDidFocusEditorText(refresh),
            editor.onDidBlurEditorText(refresh),
            editor.onDidChangeConfiguration(e => { if (e.hasChanged(option)) refresh(); }),
        ];
        return () => subs.forEach(s => s.dispose());
    }, [editor, monaco]);

    if (!editor || !monaco || !editor.hasTextFocus()) return null;
    const tabMovesFocus = !!editor.getOption(monaco.editor.EditorOption.tabFocusMode);
    return (
        <div className="editor-kbd-hint" aria-hidden>
            {tabMovesFocus ? 'Tab moves focus' : 'Tab indents'} · <kbd>{TAB_FOCUS_SHORTCUT}</kbd> to switch
        </div>
    );
}
