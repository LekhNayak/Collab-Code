import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronRight, FilePlus2, FolderPlus, Trash2, Pencil, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    onDownloadFile?: (path: string) => void;
}

// What opening the context menu needs from an event, so a mouse click and a key press can both provide it
interface MenuPoint {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation: () => void;
}

// The tree is a flat list of rows in the DOM (nested groups just indent them), so moving between rows is moving
// through that list. A folder that is closed has no rows below it, so the list is exactly what is visible.
function treeRows(from: HTMLElement): HTMLElement[] {
    const tree = from.closest('[role="tree"]');
    return tree ? [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')] : [];
}

function focusRow(row: HTMLElement | undefined) {
    row?.focus();
    row?.scrollIntoView({ block: 'nearest' });
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
    onDownloadFile,
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

    const menuTrigger = useRef<HTMLElement | null>(null);

    const handleContextMenu = useCallback((e: MenuPoint, node: FileNode) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, node });
    }, []);

    const startRename = useCallback((node: FileNode) => {
        setRenamingPath(node.path);
        setRenameValue(node.name);
    }, []);

    // A menu opened from the keyboard takes focus; Esc or Tab puts it back on the row it came from
    useEffect(() => {
        if (!contextMenu) return;
        menuTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }, [contextMenu]);

    const closeMenu = (restoreFocus: boolean) => {
        setContextMenu(null);
        if (restoreFocus) menuTrigger.current?.focus();
    };

    const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const go = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
        switch (e.key) {
            case 'ArrowDown': go(index + 1); break;
            case 'ArrowUp': go(index - 1); break;
            case 'Home': go(0); break;
            case 'End': go(items.length - 1); break;
            case 'Escape':
            case 'Tab':
                e.preventDefault();
                closeMenu(true);
                break;
        }
    };

    // Exactly one row is a tab stop (the selected one, else the first), and it follows focus
    const treeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const first = treeRef.current?.querySelector<HTMLElement>('[role="treeitem"]');
        if (!first) return;
        const rows = treeRows(first);
        if (!rows.some(r => r.tabIndex === 0)) rows[0].tabIndex = 0;
    });

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
        <div
            ref={treeRef}
            className="file-explorer"
            role="tree"
            aria-label="Files"
            onContextMenu={(e) => e.preventDefault()}
            onFocus={(e) => {
                // Roving tab stop: the row that has focus is the one Tab will come back to
                const row = e.target as HTMLElement;
                if (row.getAttribute('role') !== 'treeitem') return;
                treeRows(row).forEach(r => { r.tabIndex = r === row ? 0 : -1; });
            }}
        >
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
                    onStartRename={startRename}
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
                        aria-label={inlineCreate.type === 'folder' ? 'New folder name' : 'New file name'}
                        placeholder={inlineCreate.type === 'folder' ? 'folder name...' : 'filename.ext...'}
                    />
                </form>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label="File actions"
                    onKeyDown={onMenuKeyDown}
                    className="file-context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    {contextMenu.node.type === 'folder' && (
                        <>
                            <button role="menuitem" onClick={() => {
                                setInlineCreate({ parentPath: contextMenu.node.path, type: 'file' });
                                setInlineName('');
                                setContextMenu(null);
                            }}>
                                <FilePlus2 size={13} /> New File
                            </button>
                            <button role="menuitem" onClick={() => {
                                setInlineCreate({ parentPath: contextMenu.node.path, type: 'folder' });
                                setInlineName('');
                                setContextMenu(null);
                            }}>
                                <FolderPlus size={13} /> New Folder
                            </button>
                            <div className="context-menu-divider" />
                        </>
                    )}
                    <button role="menuitem" onClick={() => {
                        startRename(contextMenu.node);
                        setContextMenu(null);
                    }}>
                        <Pencil size={13} /> Rename
                    </button>
                    <button role="menuitem" onClick={() => {
                        onDownloadFile?.(contextMenu.node.path);
                        setContextMenu(null);
                    }}>
                        <Download size={13} /> Download
                    </button>
                    <button role="menuitem" className="context-menu-danger" onClick={() => {
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
    onContextMenu: (e: MenuPoint, node: FileNode) => void;
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
    onStartRename: (node: FileNode) => void;
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
    onStartRename,
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

    // Keyboard: the arrows walk the tree, Enter/Space open a file or fold a folder, F2 renames and the menu key (or
    // Shift+F10) opens the same actions a right-click does (WCAG 2.1.1)
    const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget || isRenaming) return;
        const row = e.currentTarget;
        const rows = treeRows(row);
        const at = rows.indexOf(row);
        const level = depth + 1;
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                handleClick();
                break;
            case 'ArrowDown': e.preventDefault(); focusRow(rows[at + 1]); break;
            case 'ArrowUp': e.preventDefault(); focusRow(rows[at - 1]); break;
            case 'Home': e.preventDefault(); focusRow(rows[0]); break;
            case 'End': e.preventDefault(); focusRow(rows[rows.length - 1]); break;
            case 'ArrowRight':
                if (node.type !== 'folder') break;
                e.preventDefault();
                if (!isOpen) setIsOpen(true);
                else if (node.children?.length) focusRow(rows[at + 1]);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (node.type === 'folder' && isOpen) {
                    setIsOpen(false);
                } else {
                    // Up to the folder this row is in: the nearest row above with a shallower level
                    for (let i = at - 1; i >= 0; i--) {
                        if (Number(rows[i].getAttribute('aria-level')) < level) { focusRow(rows[i]); break; }
                    }
                }
                break;
            case 'F2':
                e.preventDefault();
                onStartRename(node);
                break;
            case 'ContextMenu':
            case 'F10': {
                if (e.key === 'F10' && !e.shiftKey) break;
                e.preventDefault();
                const box = row.getBoundingClientRect();
                onContextMenu({ clientX: box.left + 28, clientY: box.bottom, preventDefault: () => {}, stopPropagation: () => {} }, node);
                break;
            }
        }
    };

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
                role="treeitem"
                aria-level={depth + 1}
                aria-selected={isSelected}
                aria-expanded={node.type === 'folder' ? isOpen : undefined}
                tabIndex={isSelected ? 0 : -1}
                onKeyDown={onRowKeyDown}
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
                    <span className={`chevron${isOpen ? ' open' : ''}`} aria-hidden>
                        <ChevronRight size={14} />
                    </span>
                ) : (
                    <span className="indent" aria-hidden style={{ width: 16 }} />
                )}
                <span className="file-icon" aria-hidden>
                    <FileIcon name={node.name} isFolder={node.type === 'folder'} isOpen={isOpen} />
                </span>
                {isRenaming ? (
                    <form onSubmit={onRenameSubmit} className="inline-rename-form">
                        <input
                            autoFocus
                            aria-label="New name"
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

            <AnimatePresence initial={false}>
                {node.type === 'folder' && isOpen && (
                    <motion.div
                        role="group"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
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
                                    aria-label={inlineCreate!.type === 'folder' ? 'New folder name' : 'New file name'}
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
                                    onStartRename={onStartRename}
                                />
                            ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
