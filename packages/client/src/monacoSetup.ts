// Use the bundled monaco-editor instead of @monaco-editor/react's default jsDelivr download,
// with Vite-built language workers. Imported by the components that render an editor, which are
// lazy-loaded routes, so Monaco stays out of the initial bundle.

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
        if (label === 'json') return new JsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
        if (label === 'typescript' || label === 'javascript') return new TsWorker();
        return new EditorWorker();
    },
};

loader.config({ monaco });

// Monaco rejects an internal promise with a "Canceled" error whenever the editor switches models
// (its word highlighter cancels a pending delay) and nothing awaits it. Harmless; keep it out of the console.
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error && reason.name === 'Canceled' && reason.message === 'Canceled') event.preventDefault();
});
