import { useState, useRef, useEffect, useCallback } from 'react';
import { executeCode, executeExamCode, type ExecutionResult } from '../api';

interface TerminalProps {
    id: string;
    examId?: string;
    activeFile?: string;
    activeCode?: string;
    activeLanguage?: string;
    // File system callbacks
    onCreateFile?: (path: string, isFolder: boolean) => Promise<void>;
    onDeleteFile?: (path: string) => Promise<void>;
    onMoveFile?: (oldPath: string, newPath: string) => Promise<void>;
    onReadFile?: (path: string) => Promise<string>;
    onListFiles?: () => { name: string; path: string; type: string }[];
}

interface TerminalLine {
    type: 'input' | 'output' | 'error' | 'system';
    content: string;
}

// Map Monaco language IDs to Piston language names
const EXEC_LANG_MAP: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    go: 'go',
    rust: 'rust',
    shell: 'bash',
};

// Map commands like "python", "node" etc. to Piston language names
const CMD_LANG_MAP: Record<string, string> = {
    python: 'python',
    python3: 'python',
    py: 'python',
    node: 'javascript',
    nodejs: 'javascript',
    ts: 'typescript',
    tsc: 'typescript',
    gcc: 'c',
    'g++': 'cpp',
    go: 'go',
    rustc: 'rust',
    bash: 'bash',
    sh: 'bash',
    java: 'java',
    javac: 'java',
};

export default function Terminal({
    id,
    examId,
    activeFile,
    activeCode,
    activeLanguage,
    onCreateFile,
    onDeleteFile,
    onMoveFile,
    onReadFile,
    onListFiles,
}: TerminalProps) {
    const [lines, setLines] = useState<TerminalLine[]>([
        { type: 'system', content: '─── Colab Code Editor Terminal ───' },
        { type: 'system', content: 'Type "help" for available commands' },
    ]);
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [cwd, setCwd] = useState('/');

    // Auto-scroll to bottom when new lines appear
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [lines]);

    const appendLine = useCallback((type: TerminalLine['type'], content: string) => {
        setLines(prev => [...prev, { type, content }]);
    }, []);

    const appendMultiLine = useCallback((type: TerminalLine['type'], text: string) => {
        if (!text) return;
        const newLines = text.split('\n').map(line => ({ type, content: line }));
        setLines(prev => [...prev, ...newLines]);
    }, []);

    // Resolve relative path to absolute workspace path
    const resolvePath = useCallback((inputPath: string): string => {
        if (inputPath.startsWith('/')) return inputPath;
        if (cwd === '/') return '/' + inputPath;
        return cwd + '/' + inputPath;
    }, [cwd]);

    const runCode = useCallback(async (code: string, language: string, label?: string) => {
        appendLine('system', `▶ Running ${label || 'code'} (${language})...`);
        setIsRunning(true);

        try {
            let result: ExecutionResult;
            if (examId) {
                result = await executeExamCode(examId, code, language);
            } else {
                result = await executeCode(code, language);
            }

            if (result.stdout) appendMultiLine('output', result.stdout);
            if (result.stderr) appendMultiLine('error', result.stderr);
            if (result.error) appendLine('error', result.error);

            const exitInfo = result.exitCode !== undefined ? ` | exit: ${result.exitCode}` : '';
            const timeInfo = result.executionTime ? ` | ${result.executionTime}ms` : '';
            appendLine('system', `─── ${result.status}${exitInfo}${timeInfo} ───`);
        } catch (err: any) {
            appendLine('error', `Execution failed: ${err.message}`);
            appendLine('system', 'Make sure Docker services are running (docker-compose up -d)');
        } finally {
            setIsRunning(false);
        }
    }, [appendLine, appendMultiLine]);

    const handleCommand = useCallback(async (cmd: string) => {
        appendLine('input', `$ ${cmd}`);
        const trimmed = cmd.trim();
        const lower = trimmed.toLowerCase();

        if (!trimmed) return;

        // ---- Built-in commands ----

        if (lower === 'help') {
            appendLine('system', '═══ Available Commands ═══');
            appendLine('system', '');
            appendLine('system', '  File System:');
            appendLine('system', '    touch <file>        Create a new file');
            appendLine('system', '    mkdir <dir>         Create a new folder');
            appendLine('system', '    rm <path>           Delete a file or folder');
            appendLine('system', '    mv <src> <dest>     Move / rename a file');
            appendLine('system', '    cat <file>          Print file contents');
            appendLine('system', '    ls                  List files in workspace');
            appendLine('system', '    pwd                 Print working directory');
            appendLine('system', '    cd <dir>            Change directory');
            appendLine('system', '');
            appendLine('system', '  Code Execution:');
            appendLine('system', '    run                 Execute the active file');
            appendLine('system', '    python <file>       Run with Python');
            appendLine('system', '    node <file>         Run with Node.js');
            appendLine('system', '    go / java / rust    Run with other langs');
            appendLine('system', '');
            appendLine('system', '  Other:');
            appendLine('system', '    clear / cls         Clear terminal');
            appendLine('system', '    echo <msg>          Print a message');
            appendLine('system', '    lang                Show active language');
            appendLine('system', '    pwd                 Print working directory');
            return;
        }

        if (lower === 'clear' || lower === 'cls') {
            setLines([]);
            return;
        }

        if (lower === 'pwd') {
            appendLine('output', cwd);
            return;
        }

        // ---- File system commands ----
        const parts = trimmed.split(/\s+/);
        const cmdName = parts[0].toLowerCase();
        const args = parts.slice(1);

        // touch <file> [file2] ...
        if (cmdName === 'touch') {
            if (args.length === 0) {
                appendLine('error', 'Usage: touch <filename> [filename2] ...');
                return;
            }
            for (const arg of args) {
                try {
                    const fullPath = resolvePath(arg);
                    await onCreateFile?.(fullPath, false);
                    appendLine('output', `Created file: ${fullPath}`);
                } catch (err: any) {
                    appendLine('error', `touch: ${arg}: ${err.message}`);
                }
            }
            return;
        }

        // mkdir <dir> [dir2] ...
        if (cmdName === 'mkdir') {
            if (args.length === 0) {
                appendLine('error', 'Usage: mkdir <dirname> [dirname2] ...');
                return;
            }
            for (const arg of args) {
                try {
                    const fullPath = resolvePath(arg);
                    await onCreateFile?.(fullPath, true);
                    appendLine('output', `Created folder: ${fullPath}`);
                } catch (err: any) {
                    appendLine('error', `mkdir: ${arg}: ${err.message}`);
                }
            }
            return;
        }

        // rm <path> [path2] ...
        if (cmdName === 'rm' || cmdName === 'rmdir') {
            if (args.length === 0) {
                appendLine('error', 'Usage: rm <path> [path2] ...');
                return;
            }
            // Filter out flags like -r, -f, -rf
            const paths = args.filter(a => !a.startsWith('-'));
            if (paths.length === 0) {
                appendLine('error', 'Usage: rm <path>');
                return;
            }
            for (const arg of paths) {
                try {
                    const fullPath = resolvePath(arg);
                    await onDeleteFile?.(fullPath);
                    appendLine('output', `Deleted: ${fullPath}`);
                } catch (err: any) {
                    appendLine('error', `rm: ${arg}: ${err.message}`);
                }
            }
            return;
        }

        // mv <source> <destination>
        if (cmdName === 'mv' || cmdName === 'rename') {
            if (args.length < 2) {
                appendLine('error', 'Usage: mv <source> <destination>');
                return;
            }
            try {
                const oldPath = resolvePath(args[0]);
                const newPath = resolvePath(args[1]);
                await onMoveFile?.(oldPath, newPath);
                appendLine('output', `Moved: ${oldPath} → ${newPath}`);
            } catch (err: any) {
                appendLine('error', `mv: ${err.message}`);
            }
            return;
        }

        // cat <file>
        if (cmdName === 'cat') {
            if (args.length === 0) {
                appendLine('error', 'Usage: cat <filename>');
                return;
            }
            try {
                const fullPath = resolvePath(args[0]);
                const content = await onReadFile?.(fullPath);
                if (content !== undefined) {
                    appendMultiLine('output', content || '(empty file)');
                } else {
                    appendLine('error', 'cat: file read not available');
                }
            } catch (err: any) {
                appendLine('error', `cat: ${args[0]}: ${err.message}`);
            }
            return;
        }

        // ls [path]
        if (cmdName === 'ls' || cmdName === 'dir') {
            const fileList = onListFiles?.();
            if (!fileList) {
                appendLine('error', 'ls: file listing not available');
                return;
            }

            // If a path argument is given, filter to that folder
            const targetDir = args.length > 0 ? resolvePath(args[0]) : cwd;

            const filtered = fileList.filter(f => {
                const parentDir = f.path.substring(0, f.path.lastIndexOf('/')) || '/';
                return parentDir === targetDir || (targetDir === '/' && !f.path.slice(1).includes('/'));
            });

            if (filtered.length === 0) {
                appendLine('system', '(empty)');
            } else {
                // Sort: folders first
                filtered.sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'folder' ? -1 : 1;
                });
                for (const f of filtered) {
                    const icon = f.type === 'folder' ? '📁' : '📄';
                    appendLine('output', `  ${icon} ${f.name}`);
                }
            }
            return;
        }

        // cd <dir>
        if (cmdName === 'cd') {
            if (args.length === 0 || args[0] === '/' || args[0] === '~') {
                setCwd('/');
                appendLine('system', 'Changed to /');
                return;
            }
            if (args[0] === '..') {
                const parent = cwd.substring(0, cwd.lastIndexOf('/')) || '/';
                setCwd(parent);
                appendLine('system', `Changed to ${parent}`);
                return;
            }
            const newDir = resolvePath(args[0]);
            // Check if dir exists in file list
            const fileList = onListFiles?.();
            const exists = fileList?.find(f => f.path === newDir && f.type === 'folder');
            if (exists) {
                setCwd(newDir);
                appendLine('system', `Changed to ${newDir}`);
            } else {
                appendLine('error', `cd: ${args[0]}: No such directory`);
            }
            return;
        }

        // ---- Code execution commands ----

        if (lower === 'run') {
            if (!activeCode || !activeLanguage) {
                appendLine('error', 'No active file to run. Open a file first.');
                return;
            }
            const execLang = EXEC_LANG_MAP[activeLanguage];
            if (!execLang) {
                appendLine('error', `Language "${activeLanguage}" not supported for execution.`);
                appendLine('system', `Supported: ${Object.keys(EXEC_LANG_MAP).join(', ')}`);
                return;
            }
            await runCode(activeCode, execLang, activeFile);
            return;
        }

        if (lower === 'lang') {
            appendLine('output', `Language: ${activeLanguage || 'none'}`);
            appendLine('output', `File: ${activeFile || 'none'}`);
            return;
        }

        if (lower.startsWith('echo ')) {
            appendLine('output', cmd.substring(5));
            return;
        }

        // ---- Language execution commands ----
        if (CMD_LANG_MAP[cmdName]) {
            if (!activeCode) {
                appendLine('error', 'No file content. Open a file in the editor first.');
                return;
            }
            const label = parts.length > 1 ? parts.slice(1).join(' ') : activeFile;
            await runCode(activeCode, CMD_LANG_MAP[cmdName], label);
            return;
        }

        appendLine('error', `Unknown command: "${cmdName}". Type "help" for commands.`);
    }, [appendLine, appendMultiLine, runCode, activeCode, activeLanguage, activeFile, cwd, resolvePath, onCreateFile, onDeleteFile, onMoveFile, onReadFile, onListFiles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRunning || !input.trim()) return;
        const cmd = input;
        setInput('');
        setCommandHistory(prev => [cmd, ...prev]);
        setHistoryIndex(-1);
        await handleCommand(cmd);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
                const newIdx = historyIndex + 1;
                setHistoryIndex(newIdx);
                setInput(commandHistory[newIdx]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIdx = historyIndex - 1;
                setHistoryIndex(newIdx);
                setInput(commandHistory[newIdx]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    // Build prompt showing cwd
    const promptDir = cwd === '/' ? '~' : cwd.split('/').pop() || '~';

    return (
        <div
            className="terminal-container"
            onClick={() => inputRef.current?.focus()}
        >
            <div className="terminal-lines">
                {lines.map((line, i) => (
                    <div key={`${id}-${i}`} className={`terminal-line terminal-line--${line.type}`}>
                        {line.content || '\u00A0'}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
            <form onSubmit={handleSubmit} className="terminal-input-row">
                <span className="terminal-prompt-char">
                    {isRunning ? '⏳' : <>{promptDir} $</>}
                </span>
                <input
                    ref={inputRef}
                    type="text"
                    className="terminal-cmd-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isRunning}
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={isRunning ? 'Running...' : 'Type a command...'}
                />
            </form>
        </div>
    );
}
