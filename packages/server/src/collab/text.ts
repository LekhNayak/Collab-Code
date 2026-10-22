// Text normalization shared by everything that moves file content in or out of a Y.Doc.
//
// Invariant: a Y.Text never contains "\r" or a BOM. Monaco normalizes line endings inside its
// model, so any "\r\n" in the shared text would shift every offset y-monaco computes. The original
// line ending and BOM are kept in the doc's "saved" map and re-applied when the file is written.

// Last durably saved state of a file, stored per path in the doc's "saved" Y.Map
export interface SavedMeta {
    h: string;      // cyrb53 of the normalized text
    crlf: boolean;  // file used CRLF line endings
    bom: boolean;   // file started with a UTF-8 BOM
}

// 53-bit string hash. Keep identical to packages/client/src/collab/hash.ts — the client compares
// its own hash of the text against saved.h to decide whether a tab has unsaved changes.
export function cyrb53(str: string, seed = 0): string {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Decodes file bytes as UTF-8 text, or returns null for binary / non-UTF-8 files
export function decodeText(buf: Buffer): string | null {
    if (buf.includes(0)) return null;
    const str = buf.toString('utf-8');
    // Round-trip check: rewriting a latin-1 file would replace characters with U+FFFD
    if (!Buffer.from(str, 'utf-8').equals(buf)) return null;
    return str;
}

export function toY(raw: string): { text: string; meta: SavedMeta } {
    const bom = raw.charCodeAt(0) === 0xfeff;
    const body = bom ? raw.slice(1) : raw;
    const crlfCount = (body.match(/\r\n/g) || []).length;
    const lfCount = (body.match(/\n/g) || []).length - crlfCount;
    const text = body.replace(/\r\n?/g, '\n');
    // Mixed files are normalized to their dominant line ending on first save, like VS Code
    return { text, meta: { h: cyrb53(text), crlf: crlfCount > lfCount, bom } };
}

export function fromY(text: string, meta: Pick<SavedMeta, 'crlf' | 'bom'>): string {
    const body = meta.crlf ? text.replace(/\n/g, '\r\n') : text;
    return meta.bom ? '﻿' + body : body;
}
