import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, FilePlus2, FolderPlus, Trash2, Pencil } from 'lucide-react';
import FileIcon from './FileIcon';

export interface FileNode {
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
    path: string;
    language?: string;
    content?: string;
}

interface FileExplorerProps {
    files: FileNode[];
    onFileSelect: (file: FileNode) => void;
    selectedPath?: string;
    onMoveFile?: (oldPath: string, newPath: string) => void;
    onCreateFile?: (parentPath: string, name: string, isFolder: boolean) => void;
    onDeleteFile?: (path: string) => void;
    onRenameFile?: (oldPath: string, newName: string) => void;
}

// Context menu state
interface ContextMenu {
    x: number;
    y: number;
    node: FileNode;
}

export default function FileExplorer({
    files,
    onFileSelect,
    selectedPath,
    onMoveFile,
    onCreateFile,
    onDeleteFile,
    onRenameFile,
}: FileExplorerProps) {
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
    const [inlineCreate, setInlineCreate] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
    const [inlineName, setInlineName] = useState('');
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Close context menu on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [contextMenu]);

    const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    }, []);

    const handleInlineSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!inlineCreate || !inlineName.trim()) return;
        onCreateFile?.(inlineCreate.parentPath, inlineName.trim(), inlineCreate.type === 'folder');
        setInlineCreate(null);
        setInlineName('');
    }, [inlineCreate, inlineName, onCreateFile]);

    const handleRenameSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingPath || !renameValue.trim()) return;
        onRenameFile?.(renamingPath, renameValue.trim());
        setRenamingPath(null);
        setRenameValue('');
    }, [renamingPath, renameValue, onRenameFile]);

    return (
        <div className="file-explorer" onContextMenu={(e) => e.preventDefault()}>
            {files.map((node) => (
                <TreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    onFileSelect={onFileSelect}
                    selectedPath={selectedPath}
                    onContextMenu={handleContextMenu}
                    onMoveFile={onMoveFile}
                    inlineCreate={inlineCreate}
                    inlineName={inlineName}
                    onInlineNameChange={setInlineName}
                    onInlineSubmit={handleInlineSubmit}
                    onInlineCancel={() => { setInlineCreate(null); setInlineName(''); }}
                    renamingPath={renamingPath}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onRenameSubmit={handleRenameSubmit}
                    onRenameCancel={() => { setRenamingPath(null); setRenameValue(''); }}
                />
            ))}

            {/* Root-level inline create */}
            {inlineCreate && inlineCreate.parentPath === '/' && (
                <form className="inline-create-form" onSubmit={handleInlineSubmit} style={{ paddingLeft: 20 }}>
                    <input
                        autoFocus
                        className="inline-create-input"
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        onBlur={() => { setInlineCreate(null); setInlineName(''); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setInlineCreate(null); setInlineName(''); } }}
                        placeholder={inlineCreate.type === 'folder' ? 'folder name...' : 'filename.ext...'}
                    />
                </form>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    className="file-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.node.type === 'folder' && (
                        <>
                            <button onClick={() => {
                                setInlineCreate({ parentPath: contextMenu.node.path, type: 'file' });
                                setInlineName('');
                                setContextMenu(null);
                            }}>
                                <FilePlus2 size={13} /> New File
                            </button>
                            <button onClick={() => {
                                setInlineCreate({ parentPath: contextMenu.node.path, type: 'folder' });
                                setInlineName('');
                                setContextMenu(null);
                            }}>
                                <FolderPlus size={13} /> New Folder
                            </button>
                            <div className="context-menu-divider" />
                        </>
                    )}
                    <button onClick={() => {
                        setRenamingPath(contextMenu.node.path);
                        setRenameValue(contextMenu.node.name);
                        setContextMenu(null);
                    }}>
                        <Pencil size={13} /> Rename
                    </button>
                    <button className="context-menu-danger" onClick={() => {
                        onDeleteFile?.(contextMenu.node.path);
                        setContextMenu(null);
                    }}>
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            )}
        </div>
    );
}

interface TreeItemProps {
    node: FileNode;
    depth: number;
    onFileSelect: (file: FileNode) => void;
    selectedPath?: string;
    onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
    onMoveFile?: (oldPath: string, newPath: string) => void;
    inlineCreate: { parentPath: string; type: 'file' | 'folder' } | null;
    inlineName: string;
    onInlineNameChange: (name: string) => void;
    onInlineSubmit: (e: React.FormEvent) => void;
    onInlineCancel: () => void;
    renamingPath: string | null;
    renameValue: string;
    onRenameValueChange: (v: string) => void;
    onRenameSubmit: (e: React.FormEvent) => void;
    onRenameCancel: () => void;
}

function TreeItem({
    node,
    depth,
    onFileSelect,
    selectedPath,
    onContextMenu,
    onMoveFile,
    inlineCreate,
    inlineName,
    onInlineNameChange,
    onInlineSubmit,
    onInlineCancel,
    renamingPath,
    renameValue,
    onRenameValueChange,
    onRenameSubmit,
    onRenameCancel,
}: TreeItemProps) {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const [dragOver, setDragOver] = useState(false);
    const isRenaming = renamingPath === node.path;

    const handleClick = () => {
        if (isRenaming) return;
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            onFileSelect(node);
        }
    };

    const isSelected = node.path === selectedPath;

    // ---- Drag source ----
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', node.path);
        e.dataTransfer.effectAllowed = 'move';
    };

    // ---- Drop target (folders only) ----
    const handleDragOver = (e: React.DragEvent) => {
        if (node.type !== 'folder') return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(true);
    };

    const handleDragLeave = () => setDragOver(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (node.type !== 'folder') return;

        const sourcePath = e.dataTransfer.getData('text/plain');
        if (!sourcePath || sourcePath === node.path) return;

        // Don't drop into itself or a child of itself
        if (node.path.startsWith(sourcePath + '/')) return;

        // Calculate new path
        const fileName = sourcePath.split('/').pop() || '';
        const newPath = node.path === '/' ? `/${fileName}` : `${node.path}/${fileName}`;

        if (newPath === sourcePath) return;

        onMoveFile?.(sourcePath, newPath);
        // Auto-open the folder
        setIsOpen(true);
    };

    // Show inline create input inside this folder
    const showInlineHere = inlineCreate && inlineCreate.parentPath === node.path && node.type === 'folder';

    return (
        <>
            <div
                className={`file-tree-item${isSelected ? ' selected' : ''}${dragOver ? ' drag-over' : ''}`}
                onClick={handleClick}
                onContextMenu={(e) => onContextMenu(e, node)}
                style={{ paddingLeft: depth * 12 + 4 }}
                draggable={!isRenaming}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {node.type === 'folder' ? (
                    <span className={`chevron${isOpen ? ' open' : ''}`}>
                        <ChevronRight size={14} />
                    </span>
                ) : (
                    <span className="indent" style={{ width: 16 }} />
                )}
                <span className="file-icon">
                    <FileIcon name={node.name} isFolder={node.type === 'folder'} isOpen={isOpen} />
                </span>
                {isRenaming ? (
                    <form onSubmit={onRenameSubmit} className="inline-rename-form">
                        <input
                            autoFocus
                            className="inline-create-input"
                            value={renameValue}
                            onChange={(e) => onRenameValueChange(e.target.value)}
                            onBlur={onRenameCancel}
                            onKeyDown={(e) => { if (e.key === 'Escape') onRenameCancel(); }}
                        />
                    </form>
                ) : (
                    <span className="file-name">{node.name}</span>
                )}
            </div>

            {node.type === 'folder' && isOpen && (
                <>
                    {/* Inline create form inside this folder */}
                    {showInlineHere && (
                        <form
                            className="inline-create-form"
                            onSubmit={onInlineSubmit}
                            style={{ paddingLeft: (depth + 1) * 12 + 20 }}
                        >
                            <input
                                autoFocus
                                className="inline-create-input"
                                value={inlineName}
                                onChange={(e) => onInlineNameChange(e.target.value)}
                                onBlur={onInlineCancel}
                                onKeyDown={(e) => { if (e.key === 'Escape') onInlineCancel(); }}
                                placeholder={inlineCreate!.type === 'folder' ? 'folder name...' : 'filename.ext...'}
                            />
                        </form>
                    )}

                    {node.children
                        ?.sort((a, b) => {
                            if (a.type === b.type) return a.name.localeCompare(b.name);
                            return a.type === 'folder' ? -1 : 1;
                        })
                        .map((child) => (
                            <TreeItem
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                onFileSelect={onFileSelect}
                                selectedPath={selectedPath}
                                onContextMenu={onContextMenu}
                                onMoveFile={onMoveFile}
                                inlineCreate={inlineCreate}
                                inlineName={inlineName}
                                onInlineNameChange={onInlineNameChange}
                                onInlineSubmit={onInlineSubmit}
                                onInlineCancel={onInlineCancel}
                                renamingPath={renamingPath}
                                renameValue={renameValue}
                                onRenameValueChange={onRenameValueChange}
                                onRenameSubmit={onRenameSubmit}
                                onRenameCancel={onRenameCancel}
                            />
                        ))}
                </>
            )}
        </>
    );
}
