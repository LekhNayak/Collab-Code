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

// The editor surface in the product's own grays: the same canvas, hairlines and blue accent as the chrome around it
export const MONACO_THEME = 'colab-dark';
monaco.editor.defineTheme(MONACO_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
        'editor.background': '#141416',
        'editor.foreground': '#d4d4d8',
        'editorLineNumber.foreground': '#56565b',
        'editorLineNumber.activeForeground': '#a1a1a6',
        'editor.lineHighlightBackground': '#1a1a1d',
        'editor.lineHighlightBorder': '#00000000',
        'editor.selectionBackground': '#2a4a80aa',
        'editor.inactiveSelectionBackground': '#2a4a8055',
        'editor.selectionHighlightBackground': '#3b82f622',
        'editor.wordHighlightBackground': '#ffffff10',
        'editorCursor.foreground': '#76a7f8',
        'editorIndentGuide.background1': '#ffffff10',
        'editorIndentGuide.activeBackground1': '#ffffff26',
        'editorWhitespace.foreground': '#ffffff1a',
        'editorBracketMatch.background': '#3b82f62e',
        'editorBracketMatch.border': '#3b82f600',
        'editorGutter.background': '#141416',
        'editorWidget.background': '#232327',
        'editorWidget.border': '#ffffff14',
        'editorSuggestWidget.background': '#232327',
        'editorSuggestWidget.border': '#ffffff14',
        'editorSuggestWidget.selectedBackground': '#2a2a2f',
        'editorHoverWidget.background': '#232327',
        'editorHoverWidget.border': '#ffffff14',
        'input.background': '#141416',
        'input.border': '#ffffff1f',
        'focusBorder': '#3b82f6',
        'scrollbarSlider.background': '#ffffff1f',
        'scrollbarSlider.hoverBackground': '#ffffff33',
        'scrollbarSlider.activeBackground': '#ffffff40',
        'minimap.background': '#141416',
    },
});

// Monaco rejects an internal promise with a "Canceled" error whenever the editor switches models
// (its word highlighter cancels a pending delay) and nothing awaits it. Harmless; keep it out of the console.
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error && reason.name === 'Canceled' && reason.message === 'Canceled') event.preventDefault();
});
