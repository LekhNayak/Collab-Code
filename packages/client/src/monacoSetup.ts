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

// Tab inside the editor indents, so the way out has to be told (WCAG 2.1.2): Monaco's own "Tab moves focus" toggle.
// Its keybinding is Ctrl+M, and Ctrl+Shift+M on a Mac.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const TAB_FOCUS_SHORTCUT = IS_MAC ? 'Ctrl+Shift+M' : 'Ctrl+M';
export const editorAriaLabel = (what: string) =>
    `${what}. Press ${IS_MAC ? 'Control Shift M' : 'Control M'} to switch the Tab key between indenting and moving focus out of the editor.`;

// The editor surface in the product's own grays: the same canvas, hairlines and blue accent as the chrome around it
export const MONACO_DARK = 'colab-dark';
export const MONACO_LIGHT = 'colab-light';
export const monacoThemeFor = (theme: 'light' | 'dark') => (theme === 'dark' ? MONACO_DARK : MONACO_LIGHT);

// Token colors Monaco's own themes ship below 4.5:1 on our editor background or current-line highlight (WCAG 1.4.3),
// nudged lighter (dark) or darker (light) just far enough to pass on both
monaco.editor.defineTheme(MONACO_DARK, {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: 'variable.predefined', foreground: '7086bc' },
        { token: 'comment', foreground: '699258' },
        { token: 'regexp', foreground: 'b86f9b' },
        { token: 'delimiter.html', foreground: '848484' },
        { token: 'delimiter.xml', foreground: '848484' },
        { token: 'tag.id.pug', foreground: '6386b6' },
        { token: 'tag.class.pug', foreground: '6386b6' },
        { token: 'string.sql', foreground: 'ff2b2b' },
    ],
    colors: {
        'editor.background': '#141416',
        'editor.foreground': '#d4d4d8',
        'editorLineNumber.foreground': '#8e8e94',
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
    rules: [
        { token: 'number', foreground: '087a50' },
        { token: 'annotation', foreground: '6b6b6b' },
        { token: 'type', foreground: '007878' },
        { token: 'tag.id.pug', foreground: '486c9d' },
        { token: 'tag.class.pug', foreground: '486c9d' },
        { token: 'metatag', foreground: 'd90000' },
        { token: 'metatag.content.html', foreground: 'd40000' },
        { token: 'metatag.html', foreground: '6b6b6b' },
        { token: 'metatag.xml', foreground: '6b6b6b' },
        { token: 'attribute.name', foreground: 'd40000' },
        { token: 'attribute.value.number', foreground: '087a50' },
        { token: 'attribute.value.unit', foreground: '087a50' },
        { token: 'string.sql', foreground: 'd40000' },
        { token: 'operator.sql', foreground: '5d6b78' },
        { token: 'predefined.sql', foreground: 'bb00bb' },
    ],
    colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#2a2a2d',
        'editorLineNumber.foreground': '#64646b',
        // the second bracket-pair color ships at 3.9:1 on white
        'editorBracketHighlight.foreground2': '#297a29',
        'editorLineNumber.activeForeground': '#55555b',
        'editor.lineHighlightBackground': '#f1f0ee',
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
