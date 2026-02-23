declare module 'y-monaco' {
    import type { Text as YText } from 'yjs';
    import type { Awareness } from 'y-protocols/awareness';
    import type { editor } from 'monaco-editor';

    export class MonacoBinding {
        constructor(
            ytext: YText,
            model: editor.ITextModel,
            editors?: Set<editor.IStandaloneCodeEditor>,
            awareness?: Awareness
        );
        destroy(): void;
    }
}
