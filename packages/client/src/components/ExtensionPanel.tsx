import { useState, useEffect, useCallback } from 'react';
import {
    Search, Download, Trash2, ChevronDown, ChevronRight,
    Palette, Code, Type, Keyboard, Eye, Wrench, Plus, Link, Upload, X
} from 'lucide-react';
import {
    getExtensions, installExtension, uninstallExtension,
    createCustomExtension, deleteCustomExtension as apiDeleteCustomExt,
    importExtensionFromUrl,
    type ExtensionInfo, type SessionInfo,
} from '../api';
import { useToast } from '../contexts/toast';

interface ExtensionPanelProps {
    sessionId: string;
    installedExtensions: string[];
    onExtensionChange: (session: SessionInfo) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    theme: <Palette size={12} />,
    snippets: <Code size={12} />,
    formatter: <Type size={12} />,
    keybindings: <Keyboard size={12} />,
    visual: <Eye size={12} />,
    tool: <Wrench size={12} />,
};

const CATEGORY_LABELS: Record<string, string> = {
    theme: 'Themes',
    snippets: 'Snippets',
    formatter: 'Formatters',
    keybindings: 'Keybindings',
    visual: 'Visual',
    tool: 'Tools',
};

const CATEGORY_OPTIONS = ['theme', 'snippets', 'formatter', 'keybindings', 'visual', 'tool'];

export default function ExtensionPanel({ sessionId, installedExtensions, onExtensionChange }: ExtensionPanelProps) {
    const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
    const toast = useToast();
    const nameOf = useCallback((extId: string) => extensions.find(e => e.id === extId)?.name ?? extId, [extensions]);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showInstalled, setShowInstalled] = useState(true);
    const [showAvailable, setShowAvailable] = useState(true);

    // Custom extension creation
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showImportUrl, setShowImportUrl] = useState(false);
    const [showPasteJson, setShowPasteJson] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [pasteJson, setPasteJson] = useState('');
    const [createError, setCreateError] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    // Custom form fields
    const [formId, setFormId] = useState('');
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formCategory, setFormCategory] = useState('theme');
    const [formIcon, setFormIcon] = useState('🧩');
    const [formConfig, setFormConfig] = useState('{}');

    const refreshExtensions = useCallback(() => {
        getExtensions()
            .then(setExtensions)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        refreshExtensions();
    }, [refreshExtensions]);

    const handleInstall = useCallback(async (extId: string) => {
        setActionLoading(extId);
        setCreateError('');
        try {
            const updated = await installExtension(sessionId, extId);
            onExtensionChange(updated);
            toast.success('Extension installed', nameOf(extId));
        } catch (err: any) {
            console.error(err);
            setCreateError(`Install failed: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    }, [sessionId, onExtensionChange, toast, nameOf]);

    const handleUninstall = useCallback(async (extId: string) => {
        setActionLoading(extId);
        setCreateError('');
        try {
            const updated = await uninstallExtension(sessionId, extId);
            onExtensionChange(updated);
            toast.success('Extension uninstalled', nameOf(extId));
        } catch (err: any) {
            console.error(err);
            setCreateError(`Uninstall failed: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    }, [sessionId, onExtensionChange, toast, nameOf]);

    const handleDeleteCustom = useCallback(async (extId: string) => {
        setActionLoading(extId);
        try {
            await apiDeleteCustomExt(extId);
            refreshExtensions();
            toast.success('Extension deleted', nameOf(extId));
        } catch (err: any) {
            console.error(err);
            toast.error('Could not delete the extension', err.message);
        } finally {
            setActionLoading(null);
        }
    }, [refreshExtensions, toast, nameOf]);

    // Create from form
    const handleCreateFromForm = async () => {
        setCreateError('');
        setCreateLoading(true);
        try {
            let config = {};
            try { config = JSON.parse(formConfig); } catch { throw new Error('Invalid JSON in config'); }
            await createCustomExtension({
                id: formId || `custom-${Date.now()}`,
                name: formName,
                description: formDesc,
                category: formCategory as any,
                icon: formIcon,
                author: 'Custom',
                version: '1.0.0',
                config,
            });
            refreshExtensions();
            toast.success('Extension created', formName || undefined);
            resetForm();
        } catch (err: any) {
            setCreateError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    // Import from URL
    const handleImportFromUrl = async () => {
        setCreateError('');
        setCreateLoading(true);
        try {
            const imported = await importExtensionFromUrl(importUrl);
            refreshExtensions();
            toast.success('Extension imported', imported?.name);
            setImportUrl('');
            setShowImportUrl(false);
        } catch (err: any) {
            setCreateError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    // Import from pasted JSON
    const handleImportFromJson = async () => {
        setCreateError('');
        setCreateLoading(true);
        try {
            const ext = JSON.parse(pasteJson);
            if (!ext.id || !ext.name || !ext.category) {
                throw new Error('JSON must have id, name, and category fields');
            }
            await createCustomExtension(ext);
            refreshExtensions();
            toast.success('Extension imported', ext.name);
            setPasteJson('');
            setShowPasteJson(false);
        } catch (err: any) {
            setCreateError(err.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const resetForm = () => {
        setFormId(''); setFormName(''); setFormDesc('');
        setFormCategory('theme'); setFormIcon('🧩'); setFormConfig('{}');
        setShowCreateForm(false); setCreateError('');
    };

    // Filter
    const filtered = extensions.filter(e => {
        if (search && !e.name.toLowerCase().includes(search.toLowerCase()) &&
            !e.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (activeCategory && e.category !== activeCategory) return false;
        return true;
    });

    const installed = filtered.filter(e => installedExtensions.includes(e.id));
    const available = filtered.filter(e => !installedExtensions.includes(e.id));
    const categories = [...new Set(extensions.map(e => e.category))];

    if (loading) {
        return <div className="ext-panel"><p className="ext-hint">Loading extensions...</p></div>;
    }

    return (
        <div className="ext-panel">
            {/* Search */}
            <div className="ext-search">
                <Search size={13} className="ext-search-icon" />
                <input
                    className="ext-search-input"
                    placeholder="Search extensions..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Category Filter */}
            <div className="ext-categories">
                <button className={`ext-cat-btn${!activeCategory ? ' active' : ''}`} onClick={() => setActiveCategory(null)}>All</button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        className={`ext-cat-btn${activeCategory === cat ? ' active' : ''}`}
                        onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                        title={CATEGORY_LABELS[cat] || cat}
                    >
                        {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat] || cat}
                    </button>
                ))}
            </div>

            {/* Add Custom Extension */}
            <div className="ext-custom-actions">
                <button className="ext-custom-btn" onClick={() => { setShowCreateForm(!showCreateForm); setShowImportUrl(false); setShowPasteJson(false); }}>
                    <Plus size={12} /> Create
                </button>
                <button className="ext-custom-btn" onClick={() => { setShowImportUrl(!showImportUrl); setShowCreateForm(false); setShowPasteJson(false); }}>
                    <Link size={12} /> Import URL
                </button>
                <button className="ext-custom-btn" onClick={() => { setShowPasteJson(!showPasteJson); setShowCreateForm(false); setShowImportUrl(false); }}>
                    <Upload size={12} /> Paste JSON
                </button>
            </div>

            {createError && <div className="ext-error">{createError}</div>}

            {/* Create Form */}
            {showCreateForm && (
                <div className="ext-create-form">
                    <div className="ext-form-header">
                        <span>Create Extension</span>
                        <button className="ext-form-close" onClick={resetForm}><X size={12} /></button>
                    </div>
                    <input className="ext-form-input" placeholder="Extension ID (e.g. custom-my-theme)" value={formId} onChange={e => setFormId(e.target.value)} />
                    <input className="ext-form-input" placeholder="Name *" value={formName} onChange={e => setFormName(e.target.value)} />
                    <input className="ext-form-input" placeholder="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
                    <div className="ext-form-row">
                        <select className="ext-form-select" value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                            {CATEGORY_OPTIONS.map(c => (
                                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                            ))}
                        </select>
                        <input className="ext-form-input ext-form-icon" placeholder="Icon" value={formIcon} onChange={e => setFormIcon(e.target.value)} maxLength={2} />
                    </div>
                    <textarea
                        className="ext-form-textarea"
                        placeholder={'Config JSON (for themes, use bgPrimary, accentPrimary, etc)'}
                        value={formConfig}
                        onChange={e => setFormConfig(e.target.value)}
                        rows={4}
                    />
                    <button className="ext-form-submit" onClick={handleCreateFromForm} disabled={!formName || createLoading}>
                        {createLoading ? 'Creating...' : 'Create Extension'}
                    </button>
                </div>
            )}

            {/* Import from URL */}
            {showImportUrl && (
                <div className="ext-create-form">
                    <div className="ext-form-header">
                        <span>Import from URL</span>
                        <button className="ext-form-close" onClick={() => setShowImportUrl(false)}><X size={12} /></button>
                    </div>
                    <p className="ext-form-hint">Paste a URL to a JSON file containing an extension definition.</p>
                    <input className="ext-form-input" placeholder="https://gist.github.com/.../raw/ext.json" value={importUrl} onChange={e => setImportUrl(e.target.value)} />
                    <button className="ext-form-submit" onClick={handleImportFromUrl} disabled={!importUrl || createLoading}>
                        {createLoading ? 'Importing...' : 'Import Extension'}
                    </button>
                </div>
            )}

            {/* Paste JSON */}
            {showPasteJson && (
                <div className="ext-create-form">
                    <div className="ext-form-header">
                        <span>Paste JSON</span>
                        <button className="ext-form-close" onClick={() => setShowPasteJson(false)}><X size={12} /></button>
                    </div>
                    <p className="ext-form-hint">Paste a full extension JSON object with id, name, category, and config fields.</p>
                    <textarea
                        className="ext-form-textarea"
                        placeholder={'{\n  "id": "custom-my-theme",\n  "name": "My Custom Theme",\n  "category": "theme",\n  "icon": "🎨",\n  "config": {\n    "bgPrimary": "#1a1a2e",\n    ...\n  }\n}'}
                        value={pasteJson}
                        onChange={e => setPasteJson(e.target.value)}
                        rows={8}
                    />
                    <button className="ext-form-submit" onClick={handleImportFromJson} disabled={!pasteJson || createLoading}>
                        {createLoading ? 'Importing...' : 'Import Extension'}
                    </button>
                </div>
            )}

            {/* Installed */}
            <div className="ext-section">
                <div className="ext-section-header" onClick={() => setShowInstalled(!showInstalled)}>
                    {showInstalled ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Installed</span>
                    <span className="ext-count">{installed.length}</span>
                </div>
                {showInstalled && (
                    <div className="ext-list">
                        {installed.length === 0 && (
                            <p className="ext-hint">No extensions installed</p>
                        )}
                        {installed.map(ext => (
                            <ExtensionCard
                                key={ext.id}
                                ext={ext}
                                installed
                                loading={actionLoading === ext.id}
                                onInstall={() => handleInstall(ext.id)}
                                onUninstall={() => handleUninstall(ext.id)}
                                onDelete={(ext as any).custom ? () => handleDeleteCustom(ext.id) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Available */}
            <div className="ext-section">
                <div className="ext-section-header" onClick={() => setShowAvailable(!showAvailable)}>
                    {showAvailable ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Available</span>
                    <span className="ext-count">{available.length}</span>
                </div>
                {showAvailable && (
                    <div className="ext-list">
                        {available.length === 0 && (
                            <p className="ext-hint">All extensions installed! 🎉</p>
                        )}
                        {available.map(ext => (
                            <ExtensionCard
                                key={ext.id}
                                ext={ext}
                                installed={false}
                                loading={actionLoading === ext.id}
                                onInstall={() => handleInstall(ext.id)}
                                onUninstall={() => handleUninstall(ext.id)}
                                onDelete={(ext as any).custom ? () => handleDeleteCustom(ext.id) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Extracted card component
function ExtensionCard({
    ext, installed, loading, onInstall, onUninstall, onDelete,
}: {
    ext: ExtensionInfo;
    installed: boolean;
    loading: boolean;
    onInstall: () => void;
    onUninstall: () => void;
    onDelete?: () => void;
}) {
    return (
        <div className={`ext-card${installed ? ' ext-card-installed' : ''}`}>
            <div className="ext-card-icon">{ext.icon}</div>
            <div className="ext-card-info">
                <div className="ext-card-name">
                    {ext.name}
                    {(ext as any).custom && <span className="ext-custom-badge">Custom</span>}
                </div>
                <div className="ext-card-desc">{ext.description}</div>
                <div className="ext-card-meta">
                    {CATEGORY_ICONS[ext.category]}
                    <span>{CATEGORY_LABELS[ext.category]}</span>
                    <span>v{ext.version}</span>
                </div>
            </div>
            <div className="ext-card-btns">
                {installed ? (
                    <button
                        className="ext-action-btn ext-uninstall-btn"
                        onClick={onUninstall}
                        disabled={loading}
                        title="Uninstall"
                    >
                        {loading ? '...' : <Trash2 size={13} />}
                    </button>
                ) : (
                    <button
                        className="ext-action-btn ext-install-btn"
                        onClick={onInstall}
                        disabled={loading}
                        title="Install"
                    >
                        {loading ? '...' : <Download size={13} />}
                    </button>
                )}
                {onDelete && !installed && (
                    <button
                        className="ext-action-btn ext-delete-custom-btn"
                        onClick={onDelete}
                        disabled={loading}
                        title="Delete custom extension"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}
