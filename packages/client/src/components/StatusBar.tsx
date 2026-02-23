import { GitBranch, AlertCircle, CheckCircle, Users } from 'lucide-react';

interface StatusBarProps {
    language: string;
    line: number;
    column: number;
    branch: string;
    connectedUsers: number;
}

export default function StatusBar({ language, line, column, branch, connectedUsers }: StatusBarProps) {
    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span className="status-item">
                    <GitBranch size={14} />
                    {branch}
                </span>
                <span className="status-item">
                    <CheckCircle size={14} />
                    0 errors
                </span>
                <span className="status-item">
                    <AlertCircle size={14} />
                    0 warnings
                </span>
            </div>
            <div className="status-bar-right">
                <span className="status-item">
                    <Users size={14} />
                    {connectedUsers} online
                </span>
                <span className="status-item">
                    Ln {line}, Col {column}
                </span>
                <span className="status-item">{language || 'Plain Text'}</span>
                <span className="status-item">UTF-8</span>
            </div>
        </div>
    );
}
