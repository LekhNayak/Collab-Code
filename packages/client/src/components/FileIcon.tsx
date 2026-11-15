import { File, Folder, FileType, Image, Settings, Database, FileText } from 'lucide-react';

// ── Language logos ───────────────────────────────────────────────────────────
// Each language is drawn as its own small mark on a 24x24 grid, in its own colors, so a tree of mixed files can be read
// at a glance. Most are a rounded tile with a short monogram; Java (a cup) and Go (a wordmark with speed lines) are
// drawn out. They are decorative: the file name beside them is what a screen reader gets.

interface Tile {
    label: string;
    bg: string;
    fg: string;
}

const tile = (label: string, bg: string, fg = '#ffffff'): Tile => ({ label, bg, fg });

const TILES: Record<string, Tile> = {
    // Scripting and web
    js: tile('JS', '#f7df1e', '#1f1f1f'),
    mjs: tile('JS', '#f7df1e', '#1f1f1f'),
    cjs: tile('JS', '#f7df1e', '#1f1f1f'),
    jsx: tile('JSX', '#149eca'),
    ts: tile('TS', '#3178c6'),
    tsx: tile('TSX', '#3178c6'),
    html: tile('<>', '#e44d26'),
    htm: tile('<>', '#e44d26'),
    css: tile('CSS', '#1572b6'),
    scss: tile('Sc', '#cd6799'),
    // Systems and application languages
    py: tile('Py', '#3776ab', '#ffd43b'),
    rs: tile('Rs', '#ce412b'),
    c: tile('C', '#5c6bc0'),
    h: tile('H', '#7986cb'),
    cpp: tile('C++', '#00599c'),
    cc: tile('C++', '#00599c'),
    cxx: tile('C++', '#00599c'),
    hpp: tile('H++', '#00599c'),
    cs: tile('C#', '#68217a'),
    php: tile('php', '#777bb4'),
    rb: tile('Rb', '#cc342d'),
    swift: tile('Sw', '#f05138'),
    kt: tile('Kt', '#7f52ff'),
    sh: tile('$_', '#4eaa25'),
    bash: tile('$_', '#4eaa25'),
    // Data and docs
    json: tile('{}', '#cbb42a', '#1f1f1f'),
    yaml: tile('Y', '#cb171e'),
    yml: tile('Y', '#cb171e'),
    sql: tile('SQL', '#336791'),
    md: tile('M↓', '#519aba'),
    xml: tile('</>', '#e67e22'),
    // Files known by name
    dockerfile: tile('Dk', '#2496ed'),
    makefile: tile('Mk', '#6d8086'),
};

function TileLogo({ spec, size }: { spec: Tile; size: number }) {
    const long = spec.label.length > 2;
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
            <rect width="24" height="24" rx="5" fill={spec.bg} />
            <text
                x="12"
                y={long ? 15.6 : 16.4}
                textAnchor="middle"
                fontSize={long ? 9.5 : 12.5}
                fontWeight="800"
                fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
                fill={spec.fg}
            >
                {spec.label}
            </text>
        </svg>
    );
}

// A cup of coffee with two wisps of steam
function JavaLogo({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
            <path d="M9 1.8c-1.3 1.5 1.3 2.4 0 4.1M13.2 0.8c-1.3 1.5 1.3 2.4 0 4.1" fill="none" stroke="#f89820" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M4.5 8.8h12v5.4a4.4 4.4 0 0 1-4.4 4.4H8.9a4.4 4.4 0 0 1-4.4-4.4V8.8z" fill="#5382a1" />
            <path d="M16.5 10.2h1.2a2.5 2.5 0 0 1 0 5h-1.2" fill="none" stroke="#5382a1" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M3 21.4h15" fill="none" stroke="#f89820" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
    );
}

// "GO" with the speed lines of its mascot's wordmark
function GoLogo({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false" style={{ flexShrink: 0 }}>
            <rect width="24" height="24" rx="5" fill="#00add8" />
            <path d="M2.6 9.4h4M1.6 12.2h5M2.6 15h4" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
            <text
                x="7.6"
                y="16.2"
                fontSize="10.6"
                fontWeight="800"
                fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"
                fill="#ffffff"
            >
                GO
            </text>
        </svg>
    );
}

// ── Everything else keeps a simple glyph ─────────────────────────────────────
const iconMap: Record<string, { icon: typeof File; color: string }> = {
    // Config
    env: { icon: Settings, color: '#6a6a6a' },
    gitignore: { icon: FileText, color: '#6a6a6a' },
    // Images
    png: { icon: Image, color: '#a074c4' },
    jpg: { icon: Image, color: '#a074c4' },
    svg: { icon: Image, color: '#ffb13b' },
    // Database
    prisma: { icon: Database, color: '#2d3748' },
    // Other
    lock: { icon: FileText, color: '#6a6a6a' },
    toml: { icon: FileText, color: '#9c4221' },
};

interface FileIconProps {
    name: string;
    isFolder?: boolean;
    isOpen?: boolean;
    size?: number;
}

export default function FileIcon({ name, isFolder, isOpen, size = 16 }: FileIconProps) {
    if (isFolder) {
        return <Folder size={size} color={isOpen ? '#dcb67a' : '#c09553'} fill={isOpen ? '#dcb67a' : '#c09553'} />;
    }

    const lower = name.toLowerCase();
    const ext = lower.split('.').pop() || '';

    if (ext === 'java') return <JavaLogo size={size} />;
    if (ext === 'go') return <GoLogo size={size} />;
    const spec = TILES[ext] ?? TILES[lower];
    if (spec) return <TileLogo spec={spec} size={size} />;

    const match = iconMap[ext] || iconMap[lower];
    if (match) {
        const Icon = match.icon;
        return <Icon size={size} color={match.color} />;
    }

    return <FileType size={size} color="#969696" />;
}
