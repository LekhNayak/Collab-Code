import { useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FileIcon from './FileIcon';

export interface TabInfo {
    path: string;
    name: string;
    language: string;
    isModified?: boolean;
}

interface EditorTabsProps {
    tabs: TabInfo[];
    activeTab: string;
    onTabSelect: (path: string) => void;
    onTabClose: (path: string) => void;
}

// An ARIA tab list: one tab stop for the strip (the active tab), Left/Right/Home/End move between tabs, and Delete
// closes the focused one. The close "x" is for the mouse; the keys cover everyone else.
export default function EditorTabs({ tabs, activeTab, onTabSelect, onTabClose }: EditorTabsProps) {
    const strip = useRef<HTMLDivElement>(null);
    if (tabs.length === 0) return null;
    // The strip always keeps one tab stop, even when the active file has no tab (it was closed)
    const hasActive = tabs.some(t => t.path === activeTab);

    const focusTab = (index: number) => {
        const next = tabs[(index + tabs.length) % tabs.length];
        onTabSelect(next.path);
        // The new tab's tabIndex only becomes 0 after the select re-renders
        requestAnimationFrame(() => strip.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus());
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, path: string) => {
        if (e.target !== e.currentTarget) return;
        switch (e.key) {
            case 'ArrowRight': e.preventDefault(); focusTab(index + 1); break;
            case 'ArrowLeft': e.preventDefault(); focusTab(index - 1); break;
            case 'Home': e.preventDefault(); focusTab(0); break;
            case 'End': e.preventDefault(); focusTab(tabs.length - 1); break;
            case 'Enter':
            case ' ': e.preventDefault(); onTabSelect(path); break;
            case 'Delete': e.preventDefault(); onTabClose(path); break;
        }
    };

    return (
        <div ref={strip} className="editor-tabs" role="tablist" aria-label="Open files">
            <AnimatePresence mode="popLayout">
                {tabs.map((tab, index) => {
                    const active = tab.path === activeTab;
                    return (
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            key={tab.path}
                            role="tab"
                            aria-selected={active}
                            aria-keyshortcuts="Delete"
                            aria-label={tab.isModified ? `${tab.name}, unsaved changes` : tab.name}
                            tabIndex={active || (!hasActive && index === 0) ? 0 : -1}
                            className={`editor-tab${active ? ' active' : ''}`}
                            onClick={() => onTabSelect(tab.path)}
                            onKeyDown={(e) => onKeyDown(e, index, tab.path)}
                        >
                            <span className="tab-icon" aria-hidden>
                                <FileIcon name={tab.name} size={14} />
                            </span>
                            <span className="tab-name">{tab.name}</span>
                            {tab.isModified && <span className="tab-modified" aria-hidden />}
                            <motion.span
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="tab-close"
                                title={`Close ${tab.name}`}
                                aria-hidden
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTabClose(tab.path);
                                }}
                            >
                                <X size={14} />
                            </motion.span>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
