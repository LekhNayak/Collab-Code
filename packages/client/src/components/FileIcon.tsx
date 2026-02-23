import { File, Folder, FileJson, FileCode, FileText, FileType, Image, Settings, Database } from 'lucide-react';

const iconMap: Record<string, { icon: typeof File; color: string }> = {
    // JavaScript / TypeScript
    js: { icon: FileCode, color: '#dcdcaa' },
    jsx: { icon: FileCode, color: '#61dafb' },
    ts: { icon: FileCode, color: '#3178c6' },
    tsx: { icon: FileCode, color: '#3178c6' },
    // Web
    html: { icon: FileCode, color: '#e44d26' },
    css: { icon: FileCode, color: '#1572b6' },
    scss: { icon: FileCode, color: '#cd6799' },
    // Data
    json: { icon: FileJson, color: '#dcdcaa' },
    yaml: { icon: FileText, color: '#cb171e' },
    yml: { icon: FileText, color: '#cb171e' },
    // Config
    env: { icon: Settings, color: '#6a6a6a' },
    gitignore: { icon: FileText, color: '#6a6a6a' },
    // Images
    png: { icon: Image, color: '#a074c4' },
    jpg: { icon: Image, color: '#a074c4' },
    svg: { icon: Image, color: '#ffb13b' },
    // Database
    sql: { icon: Database, color: '#336791' },
    prisma: { icon: Database, color: '#2d3748' },
    // Markdown
    md: { icon: FileText, color: '#519aba' },
    // Python
    py: { icon: FileCode, color: '#3776ab' },
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

    const ext = name.split('.').pop()?.toLowerCase() || '';
    const match = iconMap[ext] || iconMap[name.toLowerCase()];

    if (match) {
        const Icon = match.icon;
        return <Icon size={size} color={match.color} />;
    }

    return <FileType size={size} color="#969696" />;
}
