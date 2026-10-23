// Contest languages: execution id, editor file extension and Monaco language.
// Mirrors packages/server/src/services/contest/languages.ts (the server owns the starter templates).

export interface ContestLanguageInfo {
    id: string;
    label: string;
    ext: string;
}

const MONACO_LANGUAGE: Record<string, string> = {
    python: 'python',
    cpp: 'cpp',
    c: 'c',
    java: 'java',
    javascript: 'javascript',
    typescript: 'typescript',
    go: 'go',
    rust: 'rust',
};

export const monacoLanguageFor = (languageId: string) => MONACO_LANGUAGE[languageId] ?? 'plaintext';

// Participant's file for a problem, e.g. "/A.cpp" (same rule as the server)
export const solutionPath = (problemIndex: string, language: ContestLanguageInfo) => `/${problemIndex}.${language.ext}`;
