const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = init?.headers ? { ...(init.headers as Record<string, string>) } : {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await window.fetch(input, { ...init, headers });

    if (response.status === 401) {
        // If we get an unauthorized error, the token is likely invalid or expired
        console.warn('Unauthorized access - clearing token');
        localStorage.removeItem('token');
        if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
        }
    }

    return response;
};
// ---- Git / File API ----

export async function initWorkspace(workspaceId: string) {
    const res = await fetch(`${API_BASE}/git/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function cloneRepository(repoUrl: string, workspaceId: string) {
    const res = await fetch(`${API_BASE}/git/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl, workspaceId }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getFileTree(workspaceId: string) {
    const res = await fetch(`${API_BASE}/git/tree/${workspaceId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function readFile(workspaceId: string, filePath: string) {
    // Remove leading slash
    const cleanPath = filePath.replace(/^\//, '');
    const res = await fetch(`${API_BASE}/git/file/${workspaceId}/${cleanPath}`);
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    return data.content as string;
}

export async function saveFile(workspaceId: string, filePath: string, content: string) {
    const cleanPath = filePath.replace(/^\//, '');
    const res = await fetch(`${API_BASE}/git/file/${workspaceId}/${cleanPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function createFile(workspaceId: string, filePath: string, isDirectory: boolean, content?: string) {
    const cleanPath = filePath.replace(/^\//, '');
    const res = await fetch(`${API_BASE}/git/file/${workspaceId}/${cleanPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDirectory, content }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function deleteFile(workspaceId: string, filePath: string) {
    const cleanPath = filePath.replace(/^\//, '');
    const res = await fetch(`${API_BASE}/git/file/${workspaceId}/${cleanPath}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function moveFile(workspaceId: string, oldPath: string, newPath: string) {
    const res = await fetch(`${API_BASE}/git/file/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            oldPath: oldPath.replace(/^\//, ''),
            newPath: newPath.replace(/^\//, ''),
        }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

// ---- Code Execution API ----

export interface ExecutionResult {
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
    executionTime?: number;
}

export async function executeCode(code: string, language: string, stdin?: string): Promise<ExecutionResult> {
    const res = await fetch(`${API_BASE}/execute/run/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, stdin }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function executeCodeQueued(code: string, language: string, stdin?: string): Promise<string> {
    const res = await fetch(`${API_BASE}/execute/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, stdin }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const data = await res.json();
    return data.jobId;
}

export async function getExecutionResult(jobId: string): Promise<ExecutionResult> {
    const res = await fetch(`${API_BASE}/execute/result/${jobId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

// ---- Git Source Control API ----

export interface GitStatusResult {
    isRepo: boolean;
    status: Array<{ file: string; status: string }>;
    branch: string;
    branches: string[];
    remotes: Array<{ remote: string; url: string }>;
}

export interface GitCommitLog {
    oid: string;
    fullOid: string;
    message: string;
    author: string;
    email: string;
    timestamp: number;
    date: string;
}

export async function gitInitRepo(workspaceId: string) {
    const res = await fetch(`${API_BASE}/git/repo/init/${workspaceId}`, { method: 'POST' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitStatus(workspaceId: string): Promise<GitStatusResult> {
    const res = await fetch(`${API_BASE}/git/status/${workspaceId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitAdd(workspaceId: string, files: string[] | 'all') {
    const res = await fetch(`${API_BASE}/git/add/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitUnstage(workspaceId: string, files: string[]) {
    const res = await fetch(`${API_BASE}/git/unstage/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitCommit(workspaceId: string, message: string, authorName?: string, authorEmail?: string) {
    const res = await fetch(`${API_BASE}/git/commit/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, authorName, authorEmail }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitPush(workspaceId: string, token?: string, remote?: string, branch?: string) {
    const res = await fetch(`${API_BASE}/git/push/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, remote, branch }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitPull(workspaceId: string, token?: string, remote?: string, branch?: string) {
    const res = await fetch(`${API_BASE}/git/pull/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, remote, branch }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitLog(workspaceId: string, depth: number = 20): Promise<GitCommitLog[]> {
    const res = await fetch(`${API_BASE}/git/log/${workspaceId}?depth=${depth}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitBranches(workspaceId: string): Promise<{ branches: string[]; current: string }> {
    const res = await fetch(`${API_BASE}/git/branches/${workspaceId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitCheckout(workspaceId: string, branch: string) {
    const res = await fetch(`${API_BASE}/git/checkout/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitCreateBranch(workspaceId: string, branch: string, checkout: boolean = true) {
    const res = await fetch(`${API_BASE}/git/branch/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, checkout }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function gitAddRemote(workspaceId: string, name: string, url: string) {
    const res = await fetch(`${API_BASE}/git/remote/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

// ---- Sessions & Extensions API ----

export interface ExtensionInfo {
    id: string;
    name: string;
    description: string;
    category: 'theme' | 'snippets' | 'formatter' | 'keybindings' | 'visual' | 'tool';
    icon: string;
    author: string;
    version: string;
    config?: Record<string, any>;
}

export interface SessionExtension {
    extensionId: string;
    installedAt: string;
    config?: Record<string, any>;
}

export interface SessionInfo {
    id: string;
    name: string;
    roomId: string;
    workspaceId: string;
    owner: string;
    openTabs: string[];
    activeTab: string;
    settings: Record<string, any>;
    extensions: SessionExtension[];
    createdAt: string;
    updatedAt: string;
}

export async function getExtensions(): Promise<ExtensionInfo[]> {
    const res = await fetch(`${API_BASE}/sessions/extensions`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function createSession(name: string, roomId: string, workspaceId: string, owner: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, roomId, workspaceId, owner }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getSessions(owner?: string): Promise<SessionInfo[]> {
    const url = owner ? `${API_BASE}/sessions?owner=${encodeURIComponent(owner)}` : `${API_BASE}/sessions`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getSession(id: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function saveSession(id: string, data: Partial<Pick<SessionInfo, 'name' | 'openTabs' | 'activeTab' | 'settings' | 'extensions'>>): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE}/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function deleteSession(id: string) {
    const res = await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function installExtension(sessionId: string, extensionId: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/extensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function uninstallExtension(sessionId: string, extensionId: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/extensions/${extensionId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

// ---- Custom Extensions ----

export async function createCustomExtension(ext: Omit<ExtensionInfo, 'custom'>): Promise<ExtensionInfo> {
    const res = await fetch(`${API_BASE}/sessions/extensions/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ext),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function deleteCustomExtension(id: string) {
    const res = await fetch(`${API_BASE}/sessions/extensions/custom/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function importExtensionFromUrl(url: string): Promise<ExtensionInfo> {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch extension from URL');
    const ext = await res.json();
    return createCustomExtension(ext);
}

// ---- Directory / ZIP Upload ----

export async function uploadZip(workspaceId: string, file: File): Promise<{ uploaded: number; message: string }> {
    const formData = new FormData();
    formData.append('mode', 'zip');
    formData.append('file', file, file.name);
    const res = await fetch(`${API_BASE}/git/upload/${workspaceId}`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
    }
    return res.json();
}

export async function uploadFolder(workspaceId: string, files: FileList): Promise<{ uploaded: number; message: string }> {
    const formData = new FormData();
    formData.append('mode', 'folder');
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        formData.append('files', file, file.name);
        // send the relative path so the server can reconstruct the directory structure
        formData.append('paths', (file as any).webkitRelativePath || file.name);
    }
    const res = await fetch(`${API_BASE}/git/upload/${workspaceId}`, {
        method: 'POST',
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Upload failed');
    }
    return res.json();
}

export async function downloadWorkspace(workspaceId: string, filePath?: string) {
    const url = new URL(`${API_BASE}/git/download/${workspaceId}`);
    if (filePath) {
        url.searchParams.append('path', filePath);
    }
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await window.fetch(url.toString(), { headers });
    if (!res.ok) {
        let text = 'Download failed';
        try {
            const errJson = await res.json();
            text = errJson.error || text;
        } catch {
            text = await res.text() || text;
        }
        throw new Error(text);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;

    // Read filename from Content-Disposition header if possible
    const contentDisposition = res.headers.get('Content-Disposition');
    let filename = `${workspaceId}.zip`;
    if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match && match[1]) filename = match[1];
    } else if (filePath) {
        // Fallback for files
        filename = filePath.split('/').pop() || filename;
    }

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        a.remove();
    }, 100);
}

// ---- Exam Portal API ----

export interface ExamRoom {
    id: string;
    title: string;
    ownerId: string;
    startTime: string;
    endTime: string | null;
}

export interface ExamLog {
    id: string;
    examId: string;
    userId: string;
    eventType: string;
    codeSnapshot: string | null;
    details: string | null;
    createdAt: string;
    user?: { username: string; email: string };
}

export async function createExam(title: string, startTime: string): Promise<ExamRoom> {
    const res = await fetch(`${API_BASE}/exam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, startTime }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getExams(): Promise<ExamRoom[]> {
    const res = await fetch(`${API_BASE}/exam`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getExam(examId: string): Promise<ExamRoom> {
    const res = await fetch(`${API_BASE}/exam/${examId}`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function joinExam(examId: string) {
    const res = await fetch(`${API_BASE}/exam/${examId}/join`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function getExamLogs(examId: string): Promise<ExamLog[]> {
    const res = await fetch(`${API_BASE}/exam/${examId}/logs`);
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function executeExamCode(examId: string, code: string, language: string, stdin?: string): Promise<ExecutionResult> {
    const res = await fetch(`${API_BASE}/exam/${examId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, stdin }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function sendExamAlert(examId: string, pastedLength: number, content: string) {
    const res = await fetch(`${API_BASE}/exam/${examId}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pastedLength, content }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}

export async function deleteExam(examId: string) {
    const res = await fetch(`${API_BASE}/exam/${examId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error);
    return res.json();
}
