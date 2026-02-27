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

export default function EditorTabs({ tabs, activeTab, onTabSelect, onTabClose }: EditorTabsProps) {
    if (tabs.length === 0) return null;

    return (
        <div className="editor-tabs">
            <AnimatePresence mode="popLayout">
                {tabs.map((tab) => (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={tab.path}
                        className={`editor-tab${tab.path === activeTab ? ' active' : ''}`}
                        onClick={() => onTabSelect(tab.path)}
                    >
                        <span className="tab-icon">
                            <FileIcon name={tab.name} size={14} />
                        </span>
                        <span className="tab-name">{tab.name}</span>
                        {tab.isModified && <span className="tab-modified" />}
                        <motion.span
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                onTabClose(tab.path);
                            }}
                        >
                            <X size={14} />
                        </motion.span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
