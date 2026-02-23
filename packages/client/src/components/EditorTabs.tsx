import { X } from 'lucide-react';
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
            {tabs.map((tab) => (
                <div
                    key={tab.path}
                    className={`editor-tab${tab.path === activeTab ? ' active' : ''}`}
                    onClick={() => onTabSelect(tab.path)}
                >
                    <span className="tab-icon">
                        <FileIcon name={tab.name} size={14} />
                    </span>
                    <span className="tab-name">{tab.name}</span>
                    {tab.isModified && <span className="tab-modified" />}
                    <span
                        className="tab-close"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTabClose(tab.path);
                        }}
                    >
                        <X size={14} />
                    </span>
                </div>
            ))}
        </div>
    );
}
