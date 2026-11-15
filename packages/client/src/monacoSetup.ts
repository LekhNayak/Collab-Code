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
export const MONACO_DARK = 'colab-dark';
export const MONACO_LIGHT = 'colab-light';
export const monacoThemeFor = (theme: 'light' | 'dark') => (theme === 'dark' ? MONACO_DARK : MONACO_LIGHT);

monaco.editor.defineTheme(MONACO_DARK, {
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

monaco.editor.defineTheme(MONACO_LIGHT, {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#2a2a2d',
        'editorLineNumber.foreground': '#b0b0b6',
        'editorLineNumber.activeForeground': '#55555b',
        'editor.lineHighlightBackground': '#f6f5f4',
        'editor.lineHighlightBorder': '#00000000',
        'editor.selectionBackground': '#bfd4fa',
        'editor.inactiveSelectionBackground': '#dbe7fd',
        'editor.selectionHighlightBackground': '#3b82f622',
        'editor.wordHighlightBackground': '#00000010',
        'editorCursor.foreground': '#2563eb',
        'editorIndentGuide.background1': '#0000000f',
        'editorIndentGuide.activeBackground1': '#00000026',
        'editorWhitespace.foreground': '#0000001a',
        'editorBracketMatch.background': '#2563eb22',
        'editorBracketMatch.border': '#2563eb00',
        'editorGutter.background': '#ffffff',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#00000014',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#00000014',
        'editorSuggestWidget.selectedBackground': '#ecebe9',
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#00000014',
        'input.background': '#ffffff',
        'input.border': '#0000001f',
        'focusBorder': '#2563eb',
        'scrollbarSlider.background': '#0000001f',
        'scrollbarSlider.hoverBackground': '#00000033',
        'scrollbarSlider.activeBackground': '#00000040',
        'minimap.background': '#ffffff',
    },
});

// Monaco rejects an internal promise with a "Canceled" error whenever the editor switches models
// (its word highlighter cancels a pending delay) and nothing awaits it. Harmless; keep it out of the console.
window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error && reason.name === 'Canceled' && reason.message === 'Canceled') event.preventDefault();
});
