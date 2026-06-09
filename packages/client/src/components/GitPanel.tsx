import { useState, useEffect, useCallback } from 'react';
import {
    GitBranch, Plus, Check, Upload, Download, RefreshCw,
    ChevronDown, ChevronRight, AlertCircle,
    GitCommitHorizontal, Globe, Github
} from 'lucide-react';
import {
    gitStatus, gitAdd, gitCommit, gitPush, gitPull,
    gitLog, gitCheckout, gitCreateBranch, gitInitRepo,
    gitAddRemote, cloneRepository,
    type GitStatusResult, type GitCommitLog,
} from '../api';
import GitHubOnboarding from './GitHubOnboarding';

interface GitPanelProps {
    workspaceId: string;
    username: string;
    onRefreshTree?: () => void;
}

export default function GitPanel({ workspaceId, username, onRefreshTree }: GitPanelProps) {
    const [hasCredentials, setHasCredentials] = useState(
        () => localStorage.getItem('hasGithubCredentials') === 'true'
    );
    const [showGitHubConnect, setShowGitHubConnect] = useState(false);
    const [statusData, setStatusData] = useState<GitStatusResult | null>(null);
    const [commitLog, setCommitLog] = useState<GitCommitLog[]>([]);
    const [commitMessage, setCommitMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showBranches, setShowBranches] = useState(false);
    const [showLog, setShowLog] = useState(false);
    const [showChanges, setShowChanges] = useState(true);
    const [newBranchName, setNewBranchName] = useState('');
    const [creatingBranch, setCreatingBranch] = useState(false);
    const [cloneUrl, setCloneUrl] = useState('');
    const [remoteUrl, setRemoteUrl] = useState('');
    const [showRemote, setShowRemote] = useState(false);

    const showErr = (msg: string) => {
        setError(msg);
        setTimeout(() => setError(''), 5000);
    };

    const showSuccess = (msg: string) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(''), 3000);
    };

    const refresh = useCallback(async () => {
        try {
            const data = await gitStatus(workspaceId);
            setStatusData(data);
            if (data.isRepo) {
                const log = await gitLog(workspaceId, 10);
                setCommitLog(log);
            }
        } catch (err: any) {
            console.error('Git status error:', err);
        }
    }, [workspaceId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // ---- Actions ----

    const handleInit = async () => {
        setLoading(true);
        try {
            await gitInitRepo(workspaceId);
            showSuccess('Git repository initialized');
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async () => {
        if (!cloneUrl.trim()) return;
        setLoading(true);
        try {
            await cloneRepository(cloneUrl.trim(), workspaceId);
            showSuccess('Repository cloned');
            setCloneUrl('');
            await refresh();
            onRefreshTree?.();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStageAll = async () => {
        setLoading(true);
        try {
            await gitAdd(workspaceId, 'all');
            showSuccess('All files staged');
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStageFile = async (filepath: string) => {
        try {
            await gitAdd(workspaceId, [filepath]);
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        }
    };

    const handleCommit = async () => {
        if (!commitMessage.trim()) {
            showErr('Please enter a commit message');
            return;
        }
        setLoading(true);
        try {
            await gitCommit(workspaceId, commitMessage.trim(), username, `${username}@colab.dev`);
            showSuccess('Changes committed');
            setCommitMessage('');
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePush = async () => {
        setLoading(true);
        try {
            await gitPush(workspaceId);
            showSuccess('Pushed to remote');
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePull = async () => {
        setLoading(true);
        try {
            await gitPull(workspaceId);
            showSuccess('Pulled from remote');
            await refresh();
            onRefreshTree?.();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async (branch: string) => {
        setLoading(true);
        try {
            await gitCheckout(workspaceId, branch);
            showSuccess(`Switched to ${branch}`);
            await refresh();
            onRefreshTree?.();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBranch = async () => {
        if (!newBranchName.trim()) return;
        setLoading(true);
        try {
            await gitCreateBranch(workspaceId, newBranchName.trim());
            showSuccess(`Branch "${newBranchName.trim()}" created`);
            setNewBranchName('');
            setCreatingBranch(false);
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRemote = async () => {
        if (!remoteUrl.trim()) return;
        setLoading(true);
        try {
            await gitAddRemote(workspaceId, 'origin', remoteUrl.trim());
            showSuccess('Remote added');
            setRemoteUrl('');
            setShowRemote(false);
            await refresh();
        } catch (err: any) {
            showErr(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ---- Categorize changes ----
    const staged = statusData?.status.filter(f => f.status.startsWith('*') || f.status === 'added') || [];
    const unstaged = statusData?.status.filter(f => !f.status.startsWith('*') && f.status !== 'added' && f.status !== 'unmodified') || [];

    const getStatusBadge = (status: string) => {
        const clean = status.replace('*', '');
        switch (clean) {
            case 'untracked': return <span className="git-badge git-badge-u" title="Untracked">U</span>;
            case 'modified': return <span className="git-badge git-badge-m" title="Modified">M</span>;
            case 'added': return <span className="git-badge git-badge-a" title="Added">A</span>;
            case 'deleted': return <span className="git-badge git-badge-d" title="Deleted">D</span>;
            default: return <span className="git-badge" title={status}>?</span>;
        }
    };

    // ---- GitHub credentials gate ----
    if (!hasCredentials) {
        return (
            <div className="git-panel">
                <div className="git-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 16px', gap: '12px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Github size={22} style={{ color: '#818cf8' }} />
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13, margin: 0 }}>GitHub not connected</p>
                    <p className="git-hint" style={{ margin: 0, lineHeight: 1.6 }}>
                        Connect your GitHub account to use Git features — init, commit, push, and pull.
                    </p>
                    <button className="git-btn git-btn-primary" style={{ width: '100%', marginTop: 4 }} onClick={() => setShowGitHubConnect(true)}>
                        <Github size={14} /> Connect GitHub
                    </button>
                </div>
                {showGitHubConnect && (
                    <GitHubOnboarding
                        onComplete={() => {
                            setShowGitHubConnect(false);
                            setHasCredentials(localStorage.getItem('hasGithubCredentials') === 'true');
                        }}
                    />
                )}
            </div>
        );
    }

    // ---- Not a repo ----
    if (statusData && !statusData.isRepo) {
        return (
            <div className="git-panel">
                <div className="git-section">
                    <p className="git-hint">This workspace is not a Git repository.</p>
                    <button className="git-btn git-btn-primary" onClick={handleInit} disabled={loading}>
                        <GitBranch size={14} /> Initialize Repository
                    </button>
                    <div className="git-divider" />
                    <p className="git-hint">Or clone an existing repository:</p>
                    <div className="git-input-row">
                        <input
                            className="git-input"
                            placeholder="https://github.com/user/repo.git"
                            value={cloneUrl}
                            onChange={e => setCloneUrl(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleClone(); }}
                        />
                        <button className="git-btn git-btn-sm" onClick={handleClone} disabled={loading || !cloneUrl.trim()}>
                            Clone
                        </button>
                    </div>
                </div>
                {error && <div className="git-error">{error}</div>}
                {success && <div className="git-success">{success}</div>}
            </div>
        );
    }

    // ---- Loading ----
    if (!statusData) {
        return <div className="git-panel"><p className="git-hint">Loading...</p></div>;
    }

    return (
        <>
        <div className="git-panel">
            {/* Messages */}
            {error && <div className="git-error"><AlertCircle size={12} /> {error}</div>}
            {success && <div className="git-success"><Check size={12} /> {success}</div>}

            {/* Branch & Sync */}
            <div className="git-section">
                <div className="git-row git-row-between">
                    <div className="git-branch-badge" onClick={() => setShowBranches(!showBranches)}>
                        <GitBranch size={13} />
                        <span>{statusData.branch || 'main'}</span>
                        <ChevronDown size={12} />
                    </div>
                    <div className="git-actions">
                        <button className="git-icon-btn" onClick={handlePull} title="Pull" disabled={loading}>
                            <Download size={14} />
                        </button>
                        <button className="git-icon-btn" onClick={handlePush} title="Push" disabled={loading}>
                            <Upload size={14} />
                        </button>
                        <button className="git-icon-btn" onClick={refresh} title="Refresh" disabled={loading}>
                            <RefreshCw size={14} className={loading ? 'spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Branch list */}
                {showBranches && (
                    <div className="git-dropdown">
                        {statusData.branches.map(b => (
                            <button
                                key={b}
                                className={`git-dropdown-item${b === statusData.branch ? ' active' : ''}`}
                                onClick={() => { handleCheckout(b); setShowBranches(false); }}
                            >
                                {b === statusData.branch && <Check size={12} />}
                                <span>{b}</span>
                            </button>
                        ))}
                        <div className="git-divider" />
                        {creatingBranch ? (
                            <div className="git-input-row" style={{ padding: '4px 8px' }}>
                                <input
                                    autoFocus
                                    className="git-input git-input-sm"
                                    placeholder="branch-name"
                                    value={newBranchName}
                                    onChange={e => setNewBranchName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreateBranch();
                                        if (e.key === 'Escape') { setCreatingBranch(false); setNewBranchName(''); }
                                    }}
                                    onBlur={() => { setCreatingBranch(false); setNewBranchName(''); }}
                                />
                            </div>
                        ) : (
                            <button className="git-dropdown-item" onClick={() => setCreatingBranch(true)}>
                                <Plus size={12} /> New Branch
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Commit input */}
            <div className="git-section">
                <div className="git-commit-box">
                    <input
                        className="git-input"
                        placeholder="Commit message..."
                        value={commitMessage}
                        onChange={e => setCommitMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommit(); }}
                    />
                    <button
                        className="git-btn git-btn-primary"
                        onClick={handleCommit}
                        disabled={loading || !commitMessage.trim()}
                        title="Commit (Ctrl+Enter)"
                    >
                        <Check size={14} /> Commit
                    </button>
                </div>
            </div>

            {/* Changed Files */}
            <div className="git-section">
                <div
                    className="git-section-header"
                    onClick={() => setShowChanges(!showChanges)}
                >
                    {showChanges ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span>Changes</span>
                    <span className="git-count">{statusData.status.length}</span>
                    <button
                        className="git-icon-btn git-stage-all"
                        onClick={(e) => { e.stopPropagation(); handleStageAll(); }}
                        title="Stage All"
                    >
                        <Plus size={13} />
                    </button>
                </div>

                {showChanges && (
                    <div className="git-file-list">
                        {/* Staged section */}
                        {staged.length > 0 && (
                            <>
                                <div className="git-file-group-header">Staged ({staged.length})</div>
                                {staged.map(f => (
                                    <div key={f.file} className="git-file-item">
                                        {getStatusBadge(f.status)}
                                        <span className="git-file-name">{f.file}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        {/* Unstaged / untracked */}
                        {unstaged.length > 0 && (
                            <>
                                <div className="git-file-group-header">Changes ({unstaged.length})</div>
                                {unstaged.map(f => (
                                    <div key={f.file} className="git-file-item">
                                        {getStatusBadge(f.status)}
                                        <span className="git-file-name">{f.file}</span>
                                        <button
                                            className="git-icon-btn git-file-action"
                                            onClick={() => handleStageFile(f.file)}
                                            title="Stage"
                                        >
                                            <Plus size={12} />
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                        {statusData.status.length === 0 && (
                            <p className="git-hint" style={{ padding: '6px 8px' }}>No changes</p>
                        )}
                    </div>
                )}
            </div>

            {/* Remote */}
            <div className="git-section">
                <div className="git-section-header" onClick={() => setShowRemote(!showRemote)}>
                    {showRemote ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Globe size={13} />
                    <span>Remotes</span>
                    <span className="git-count">{statusData.remotes.length}</span>
                </div>
                {showRemote && (
                    <div className="git-file-list">
                        {statusData.remotes.map(r => (
                            <div key={r.remote} className="git-file-item">
                                <span className="git-file-name" title={r.url}>
                                    <strong>{r.remote}</strong>: {r.url}
                                </span>
                            </div>
                        ))}
                        <div className="git-input-row" style={{ padding: '4px 8px' }}>
                            <input
                                className="git-input git-input-sm"
                                placeholder="https://github.com/user/repo.git"
                                value={remoteUrl}
                                onChange={e => setRemoteUrl(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddRemote(); }}
                            />
                            <button className="git-btn git-btn-sm" onClick={handleAddRemote} disabled={!remoteUrl.trim()}>
                                Add
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Commit Log */}
            <div className="git-section">
                <div className="git-section-header" onClick={() => setShowLog(!showLog)}>
                    {showLog ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <GitCommitHorizontal size={13} />
                    <span>Commits</span>
                    <span className="git-count">{commitLog.length}</span>
                </div>
                {showLog && (
                    <div className="git-commit-list">
                        {commitLog.map(c => (
                            <div key={c.fullOid} className="git-commit-item">
                                <div className="git-commit-header">
                                    <code className="git-oid">{c.oid}</code>
                                    <span className="git-commit-date">
                                        {new Date(c.date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="git-commit-msg">{c.message.split('\n')[0]}</div>
                                <div className="git-commit-author">{c.author}</div>
                            </div>
                        ))}
                        {commitLog.length === 0 && (
                            <p className="git-hint" style={{ padding: '6px 8px' }}>No commits yet</p>
                        )}
                    </div>
                )}
            </div>

            {/* GitHub credentials footer */}
            <div className="git-section" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                <button
                    className="git-hint"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'none', border: 'none', padding: '4px 8px', width: '100%', textAlign: 'left', borderRadius: 6, transition: 'color 0.15s' }}
                    onClick={() => setShowGitHubConnect(true)}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                    onMouseLeave={e => (e.currentTarget.style.color = '')}
                >
                    <Github size={12} /> Update GitHub credentials
                </button>
            </div>
        </div>

        {showGitHubConnect && (
            <GitHubOnboarding
                isUpdate
                onComplete={() => setShowGitHubConnect(false)}
            />
        )}
        </>
    );
}
