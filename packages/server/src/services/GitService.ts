import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';

export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
    content?: string;
}

export class GitService {
    private workspacesDir: string;

    constructor() {
        this.workspacesDir = process.env.DATA_DIR
            ? path.join(process.env.DATA_DIR, 'workspaces')
            : path.join(process.cwd(), 'workspaces');
        if (!fs.existsSync(this.workspacesDir)) {
            fs.mkdirSync(this.workspacesDir, { recursive: true });
        }
    }

    public getWorkspacePath(workspaceId: string): string {
        // Sanitize workspace ID to prevent path traversal
        const safe = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '');
        return path.join(this.workspacesDir, safe);
    }

    public resolveFilePath(workspaceId: string, filePath: string): string {
        const wsDir = this.getWorkspacePath(workspaceId);
        // Resolve and ensure the path stays within workspace
        const resolved = path.resolve(wsDir, filePath);

        // Strictly prevent traversal (fixes V02 prefix bypass)
        const relative = path.relative(wsDir, resolved);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error('Path traversal detected. Sandbox breach blocked.');
        }

        return resolved;
    }

    // ---- Clone ----
    async cloneRepository(repoUrl: string, workspaceId: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);

        if (fs.existsSync(dir)) {
            console.log(`Workspace ${workspaceId} already exists`);
            return;
        }

        fs.mkdirSync(dir, { recursive: true });

        try {
            await git.clone({
                fs,
                http,
                dir,
                url: repoUrl,
                onAuth: () => ({ username: process.env.GITHUB_TOKEN || '' }),
                singleBranch: true,
                depth: 1,
            });
            console.log(`Cloned ${repoUrl} to ${dir}`);
        } catch (error) {
            console.error('Git Clone Error:', error);
            fs.rmSync(dir, { recursive: true, force: true });
            throw error;
        }
    }

    // ---- File Tree ----
    getFileTree(workspaceId: string): FileTreeNode[] {
        const dir = this.getWorkspacePath(workspaceId);
        if (!fs.existsSync(dir)) return [];

        const crawl = (dirPath: string, relativeTo: string): FileTreeNode[] => {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            return entries
                .filter(e => e.name !== '.git' && e.name !== 'node_modules')
                .sort((a, b) => {
                    // Directories first, then alphabetical
                    if (a.isDirectory() !== b.isDirectory()) {
                        return a.isDirectory() ? -1 : 1;
                    }
                    return a.name.localeCompare(b.name);
                })
                .map(entry => {
                    const fullPath = path.join(dirPath, entry.name);
                    const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');

                    if (entry.isDirectory()) {
                        return {
                            name: entry.name,
                            path: '/' + relPath,
                            type: 'directory' as const,
                            children: crawl(fullPath, relativeTo),
                        };
                    }
                    return {
                        name: entry.name,
                        path: '/' + relPath,
                        type: 'file' as const,
                    };
                });
        };

        return crawl(dir, dir);
    }

    // ---- Read File ----
    readFile(workspaceId: string, filePath: string): string {
        const resolved = this.resolveFilePath(workspaceId, filePath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            throw new Error(`Path is a directory: ${filePath}`);
        }
        // Check if file is binary (simple heuristic)
        const buffer = fs.readFileSync(resolved);
        if (buffer.includes(0)) {
            throw new Error('Binary file - cannot read as text');
        }
        return buffer.toString('utf-8');
    }

    // ---- Write File ----
    writeFile(workspaceId: string, filePath: string, content: string): void {
        const resolved = this.resolveFilePath(workspaceId, filePath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`File not found: ${filePath}`);
        }
        fs.writeFileSync(resolved, content, 'utf-8');
    }

    // ---- Write File (raw buffer, binary-safe, auto-creates parents) ----
    writeFileRaw(workspaceId: string, filePath: string, buffer: Buffer): void {
        const resolved = this.resolveFilePath(workspaceId, filePath);
        const parentDir = path.dirname(resolved);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolved, buffer);
    }

    // ---- Create File/Directory ----
    createFile(workspaceId: string, filePath: string, isDirectory: boolean, content?: string): void {
        const resolved = this.resolveFilePath(workspaceId, filePath);
        if (fs.existsSync(resolved)) {
            throw new Error(`Already exists: ${filePath}`);
        }

        // Ensure parent directory exists
        const parentDir = path.dirname(resolved);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        if (isDirectory) {
            fs.mkdirSync(resolved, { recursive: true });
        } else {
            fs.writeFileSync(resolved, content || '', 'utf-8');
        }
    }

    // ---- Delete File/Directory ----
    deleteFile(workspaceId: string, filePath: string): void {
        const resolved = this.resolveFilePath(workspaceId, filePath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`Not found: ${filePath}`);
        }
        const stat = fs.statSync(resolved);
        if (stat.isDirectory()) {
            fs.rmSync(resolved, { recursive: true, force: true });
        } else {
            fs.unlinkSync(resolved);
        }
    }

    // ---- Rename/Move ----
    renameFile(workspaceId: string, oldPath: string, newPath: string): void {
        const resolvedOld = this.resolveFilePath(workspaceId, oldPath);
        const resolvedNew = this.resolveFilePath(workspaceId, newPath);

        if (!fs.existsSync(resolvedOld)) {
            throw new Error(`Not found: ${oldPath}`);
        }
        if (fs.existsSync(resolvedNew)) {
            throw new Error(`Already exists: ${newPath}`);
        }

        // Ensure parent of new path exists
        const parentDir = path.dirname(resolvedNew);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.renameSync(resolvedOld, resolvedNew);
    }

    // ---- Init empty workspace ----
    initWorkspace(workspaceId: string): void {
        const dir = this.getWorkspacePath(workspaceId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        // Create a default file
        const indexPath = path.join(dir, 'main.py');
        if (!fs.existsSync(indexPath)) {
            fs.writeFileSync(indexPath, '# Welcome to Colab Code Editor\nprint("Hello, World!")\n', 'utf-8');
        }
    }

    // ---- Git Init ----
    async gitInit(workspaceId: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        await git.init({ fs, dir });
    }

    // ---- Git Status ----
    async getStatus(workspaceId: string): Promise<Array<{ file: string; status: string }>> {
        const dir = this.getWorkspacePath(workspaceId);
        if (!fs.existsSync(dir)) return [];

        try {
            const matrix = await git.statusMatrix({ fs, dir });
            const result: Array<{ file: string; status: string }> = [];

            for (const [filepath, head, workdir, stage] of matrix) {
                // [HEAD, WORKDIR, STAGE]
                // [0, 2, 0] = new, untracked
                // [0, 2, 2] = new, staged
                // [1, 2, 1] = modified, unstaged
                // [1, 2, 2] = modified, staged
                // [1, 0, 0] = deleted, unstaged
                // [1, 0, 1] = deleted, staged
                // [1, 1, 1] = unmodified
                let status = 'unmodified';

                if (head === 0 && workdir === 2 && stage === 0) status = 'untracked';
                else if (head === 0 && workdir === 2 && stage === 2) status = 'added';
                else if (head === 0 && workdir === 2 && stage === 3) status = 'added';
                else if (head === 1 && workdir === 2 && stage === 1) status = 'modified';
                else if (head === 1 && workdir === 2 && stage === 2) status = '*modified';
                else if (head === 1 && workdir === 2 && stage === 3) status = '*modified';
                else if (head === 1 && workdir === 0 && stage === 0) status = 'deleted';
                else if (head === 1 && workdir === 0 && stage === 1) status = '*deleted';
                else if (head === 0 && workdir === 0 && stage === 3) status = 'added';
                else if (head === 1 && workdir === 1 && stage === 1) status = 'unmodified';
                else if (head === 1 && workdir === 1 && stage === 0) status = '*deleted';
                else status = `unknown(${head},${workdir},${stage})`;

                if (status !== 'unmodified') {
                    result.push({ file: filepath, status });
                }
            }

            return result;
        } catch (err: any) {
            // If no .git directory exists, return empty
            if (err.code === 'NotFoundError' || err.message?.includes('Could not find')) {
                return [];
            }
            throw err;
        }
    }

    // ---- Git Add ----
    async gitAdd(workspaceId: string, filepath: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        await git.add({ fs, dir, filepath });
    }

    // ---- Git Add All ----
    async gitAddAll(workspaceId: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        const matrix = await git.statusMatrix({ fs, dir });

        for (const [filepath, head, workdir, stage] of matrix) {
            if (workdir === 0 && head === 1) {
                // File was deleted
                await git.remove({ fs, dir, filepath });
            } else if (workdir !== stage || head !== stage) {
                await git.add({ fs, dir, filepath });
            }
        }
    }

    // ---- Git Remove (unstage) ----
    async gitRemove(workspaceId: string, filepath: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        await git.remove({ fs, dir, filepath });
    }

    // ---- Git Commit ----
    async gitCommit(workspaceId: string, message: string, authorName: string, authorEmail: string): Promise<string> {
        const dir = this.getWorkspacePath(workspaceId);
        const sha = await git.commit({
            fs,
            dir,
            message,
            author: {
                name: authorName,
                email: authorEmail,
            },
        });
        return sha;
    }

    // ---- Git Push ----
    async gitPush(workspaceId: string, token?: string, remote?: string, branch?: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        const authToken = token || process.env.GITHUB_TOKEN || '';

        await git.push({
            fs,
            http,
            dir,
            remote: remote || 'origin',
            ref: branch,
            onAuth: () => ({ username: authToken }),
        });
    }

    // ---- Git Pull ----
    async gitPull(workspaceId: string, token?: string, remote?: string, branch?: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        const authToken = token || process.env.GITHUB_TOKEN || '';

        // isomorphic-git doesn't have a direct pull — use fetch + merge via fast-forward
        await git.pull({
            fs,
            http,
            dir,
            remote: remote || 'origin',
            ref: branch,
            singleBranch: true,
            author: { name: 'Colab IDE', email: 'ide@colab.dev' },
            onAuth: () => ({ username: authToken }),
        });
    }

    // ---- Git Log ----
    async gitLog(workspaceId: string, depth: number = 20): Promise<any[]> {
        const dir = this.getWorkspacePath(workspaceId);

        try {
            const commits = await git.log({ fs, dir, depth });
            return commits.map(c => ({
                oid: c.oid.substring(0, 7),
                fullOid: c.oid,
                message: c.commit.message,
                author: c.commit.author.name,
                email: c.commit.author.email,
                timestamp: c.commit.author.timestamp,
                date: new Date(c.commit.author.timestamp * 1000).toISOString(),
            }));
        } catch {
            return [];
        }
    }

    // ---- Git Branches ----
    async getBranches(workspaceId: string): Promise<{ branches: string[]; current: string }> {
        const dir = this.getWorkspacePath(workspaceId);

        try {
            const branches = await git.listBranches({ fs, dir });
            const current = await git.currentBranch({ fs, dir }) || 'main';
            return { branches, current };
        } catch {
            return { branches: [], current: 'main' };
        }
    }

    // ---- Git Checkout ----
    async gitCheckout(workspaceId: string, branch: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        await git.checkout({ fs, dir, ref: branch });
    }

    // ---- Git Create Branch ----
    async gitCreateBranch(workspaceId: string, branch: string, checkout: boolean = true): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        await git.branch({ fs, dir, ref: branch, checkout });
    }

    // ---- Check if git repo ----
    isGitRepo(workspaceId: string): boolean {
        const dir = this.getWorkspacePath(workspaceId);
        return fs.existsSync(path.join(dir, '.git'));
    }

    // ---- Git Remote Info ----
    async getRemotes(workspaceId: string): Promise<Array<{ remote: string; url: string }>> {
        const dir = this.getWorkspacePath(workspaceId);
        try {
            const remotes = await git.listRemotes({ fs, dir });
            return remotes;
        } catch {
            return [];
        }
    }

    // ---- Add Remote ----
    async addRemote(workspaceId: string, remote: string, url: string): Promise<void> {
        const dir = this.getWorkspacePath(workspaceId);
        await git.addRemote({ fs, dir, remote, url });
    }
}
