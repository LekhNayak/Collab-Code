// Bulk test-case upload: a .zip, or loose files, paired into (input, expected output) by name.
//
// Recognised layouts (any mix, nested folders allowed):
//   1.in / 1.out        1.input / 1.output      1.in / 1.ans
//   input/1.txt / output/1.txt                  input01.txt / output01.txt
// A name starting with "sample" or "example" (or a "sample" folder) marks a sample test that participants
// can see. Samples come first, then the rest in natural order (2 before 10).

import path from 'path';
import AdmZip from 'adm-zip';
import { HttpError } from './access';

export const MAX_TESTS_PER_PROBLEM = 100;
export const MAX_TEST_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export interface UploadedFile {
    name: string;   // path inside the upload, e.g. "tests/1.in"
    data: Buffer;
}

export interface ParsedTest {
    name: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
}

const INPUT_EXT = new Set(['.in', '.input']);
const OUTPUT_EXT = new Set(['.out', '.output', '.ans', '.answer']);

// Expands a zip upload into its files, refusing archives that would unpack too large
export function expandUpload(files: UploadedFile[]): UploadedFile[] {
    const result: UploadedFile[] = [];
    let total = 0;
    for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.zip')) {
            total += file.data.length;
            result.push(file);
            continue;
        }
        const zip = new AdmZip(file.data);
        for (const entry of zip.getEntries()) {
            if (entry.isDirectory || entry.entryName.includes('__MACOSX')) continue;
            if (path.posix.basename(entry.entryName).startsWith('.')) continue;
            // Check the declared size before inflating anything
            total += entry.header.size;
            if (entry.header.size > MAX_TEST_FILE_BYTES) {
                throw new HttpError(400, `${entry.entryName} is larger than 1 MB`);
            }
            if (total > MAX_TOTAL_BYTES) throw new HttpError(400, 'The upload is larger than 50 MB');
            result.push({ name: entry.entryName, data: entry.getData() });
        }
    }
    if (total > MAX_TOTAL_BYTES) throw new HttpError(400, 'The upload is larger than 50 MB');
    return result;
}

// Classifies a file as an input or output and returns the key it pairs on
function classify(name: string): { kind: 'input' | 'output'; key: string } | null {
    const normalized = name.replace(/\\/g, '/');
    const ext = path.posix.extname(normalized).toLowerCase();
    const dir = path.posix.dirname(normalized);
    const base = path.posix.basename(normalized, path.posix.extname(normalized));

    if (INPUT_EXT.has(ext)) return { kind: 'input', key: `${dir}/${base}` };
    if (OUTPUT_EXT.has(ext)) return { kind: 'output', key: `${dir}/${base}` };

    // input/1.txt + output/1.txt
    const segments = dir.split('/');
    const folder = segments[segments.length - 1]?.toLowerCase();
    const parent = segments.slice(0, -1).join('/');
    if (folder === 'input' || folder === 'inputs' || folder === 'in') return { kind: 'input', key: `${parent}/${base}` };
    if (folder === 'output' || folder === 'outputs' || folder === 'out') return { kind: 'output', key: `${parent}/${base}` };

    // input01.txt + output01.txt
    const prefixed = /^(input|output)[-_]?(.*)$/i.exec(base);
    if (prefixed) {
        return { kind: prefixed[1].toLowerCase() === 'input' ? 'input' : 'output', key: `${dir}/${prefixed[2]}` };
    }
    return null;
}

const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export function pairTests(files: UploadedFile[]): ParsedTest[] {
    const inputs = new Map<string, Buffer>();
    const outputs = new Map<string, Buffer>();
    const unrecognised: string[] = [];
    for (const file of files) {
        const kind = classify(file.name);
        if (!kind) {
            unrecognised.push(file.name);
            continue;
        }
        if (file.data.length > MAX_TEST_FILE_BYTES) throw new HttpError(400, `${file.name} is larger than 1 MB`);
        (kind.kind === 'input' ? inputs : outputs).set(kind.key, file.data);
    }

    const missing = [
        ...[...inputs.keys()].filter(k => !outputs.has(k)).map(k => `${k} (no output)`),
        ...[...outputs.keys()].filter(k => !inputs.has(k)).map(k => `${k} (no input)`),
    ];
    if (missing.length > 0) {
        throw new HttpError(400, `Some tests are incomplete: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
    }
    if (inputs.size === 0) {
        throw new HttpError(400, unrecognised.length > 0
            ? `No test files recognised. Name them like 1.in / 1.out (got ${unrecognised.slice(0, 3).join(', ')})`
            : 'No files uploaded');
    }
    if (inputs.size > MAX_TESTS_PER_PROBLEM) throw new HttpError(400, `At most ${MAX_TESTS_PER_PROBLEM} tests per problem`);

    const tests = [...inputs.keys()].map(key => {
        const name = key.replace(/^\.\//, '').replace(/^\//, '');
        return {
            name,
            input: inputs.get(key)!.toString('utf-8'),
            expectedOutput: outputs.get(key)!.toString('utf-8'),
            isSample: /(^|\/)(sample|example)/i.test(name),
        };
    });
    // Samples first (participants see them in this order), then natural order: 2 before 10
    return tests.sort((a, b) => Number(b.isSample) - Number(a.isSample) || naturalCompare(a.name, b.name));
}
