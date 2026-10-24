// Contest languages: execution id, editor file extension and Monaco language.
// Mirrors packages/server/src/services/contest/languages.ts (the server owns the starter templates).

export interface ContestLanguageInfo {
    id: string;
    label: string;
    ext: string;
}

// SQL problems always use this one (not part of a contest's language list)
export const SQL_LANGUAGE: ContestLanguageInfo = { id: 'sql', label: 'SQL (SQLite)', ext: 'sql' };

const MONACO_LANGUAGE: Record<string, string> = {
    python: 'python',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    javascript: 'javascript',
    typescript: 'typescript',
    go: 'go',
    rust: 'rust',
    sql: 'sql',
};

export const monacoLanguageFor = (languageId: string) => MONACO_LANGUAGE[languageId] ?? 'plaintext';

// Display name of a submission's language
export const languageLabel = (languages: ContestLanguageInfo[], id: string) =>
    id === SQL_LANGUAGE.id ? SQL_LANGUAGE.label : languages.find(l => l.id === id)?.label ?? id;

// Participant's file for a problem, e.g. "/A.cpp" (same rule as the server)
export const solutionPath = (problemIndex: string, language: ContestLanguageInfo) => `/${problemIndex}.${language.ext}`;
