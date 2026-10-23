// Pure judging rules: output comparison, per-test verdicts and scoring

import type { Verdict } from '@prisma/client';

// Lenient comparison used by most judges: ignore CRLF vs LF, trailing spaces/tabs on each line
// and trailing blank lines
export function normalizeOutput(output: string): string {
    return output
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n+$/, '');
}

export const outputsMatch = (actual: string, expected: string) => normalizeOutput(actual) === normalizeOutput(expected);

// Partial credit: each test case is worth the same share of the problem's points
export function scoreFor(points: number, passed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((points * passed / total) * 100) / 100;
}

// Verdict for a whole submission from its per-test verdicts
export function overallVerdict(verdicts: Verdict[]): Verdict {
    if (verdicts.length === 0) return 'IE';
    if (verdicts.every(v => v === 'AC')) return 'AC';
    if (verdicts.includes('CE')) return 'CE';
    if (verdicts.includes('AC')) return 'PARTIAL';
    return verdicts.find(v => v !== 'AC' && v !== 'SKIPPED') ?? 'WA';
}

// Keep stored outputs small; participants only ever see sample-test outputs
export const MAX_STORED_OUTPUT = 8 * 1024;

export function clip(text: string | undefined, max = MAX_STORED_OUTPUT): string {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}\n… (truncated)` : text;
}
