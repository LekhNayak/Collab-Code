import { Router, Request, Response } from 'express';
import { GitService } from '../services/GitService';

const router = Router();
const gitService = new GitService();

// Clone a repository
router.post('/clone', async (req: Request, res: Response) => {
    const { repoUrl, workspaceId } = req.body;
    if (!repoUrl || !workspaceId) {
        return res.status(400).json({ error: 'repoUrl and workspaceId are required' });
    }
    try {
        await gitService.cloneRepository(repoUrl, workspaceId);
        res.status(200).json({ message: 'Repository cloned successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to clone repository' });
    }
});

// Initialize empty workspace
router.post('/init', (req: Request, res: Response) => {
    const { workspaceId } = req.body;
    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
    }
    try {
        gitService.initWorkspace(workspaceId);
        res.status(200).json({ message: 'Workspace initialized' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to init workspace' });
    }
});

// Get file tree for a workspace
router.get('/tree/:workspaceId', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const tree = gitService.getFileTree(workspaceId);
        res.status(200).json(tree);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to retrieve file tree' });
    }
});

// Read a file
router.get('/file/:workspaceId/*', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0]; // wildcard param
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        const content = gitService.readFile(workspaceId, filePath);
        res.status(200).json({ content, path: filePath });
    } catch (error: any) {
        const status = error.message.includes('not found') ? 404 : 500;
        res.status(status).json({ error: error.message });
    }
});

// Save/update a file
router.put('/file/:workspaceId/*', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    const { content } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    if (content === undefined) {
        return res.status(400).json({ error: 'content is required' });
    }
    try {
        gitService.writeFile(workspaceId, filePath, content);
        res.status(200).json({ message: 'File saved', path: filePath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new file or directory
router.post('/file/:workspaceId/*', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    const { isDirectory, content } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        gitService.createFile(workspaceId, filePath, !!isDirectory, content);
        res.status(201).json({ message: 'Created', path: filePath });
    } catch (error: any) {
        const status = error.message.includes('Already exists') ? 409 : 500;
        res.status(status).json({ error: error.message });
    }
});

// Delete a file or directory
router.delete('/file/:workspaceId/*', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        gitService.deleteFile(workspaceId, filePath);
        res.status(200).json({ message: 'Deleted', path: filePath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Rename/move a file
router.patch('/file/:workspaceId', (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
        return res.status(400).json({ error: 'oldPath and newPath are required' });
    }
    try {
        gitService.renameFile(workspaceId, oldPath, newPath);
        res.status(200).json({ message: 'Renamed', oldPath, newPath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============== Git Source Control =================

// Git init
router.post('/repo/init/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        await gitService.gitInit(workspaceId);
        res.json({ message: 'Git repository initialized' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git status
router.get('/status/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const isRepo = gitService.isGitRepo(workspaceId);
        const status = isRepo ? await gitService.getStatus(workspaceId) : [];
        const branchInfo = isRepo ? await gitService.getBranches(workspaceId) : { branches: [], current: '' };
        const remotes = isRepo ? await gitService.getRemotes(workspaceId) : [];
        res.json({ isRepo, status, branch: branchInfo.current, branches: branchInfo.branches, remotes });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git add (stage files)
router.post('/add/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { files } = req.body; // string[] or 'all'
    try {
        if (files === 'all') {
            await gitService.gitAddAll(workspaceId);
        } else if (Array.isArray(files)) {
            for (const f of files) {
                await gitService.gitAdd(workspaceId, f);
            }
        } else {
            return res.status(400).json({ error: 'files must be an array or "all"' });
        }
        res.json({ message: 'Files staged' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git unstage
router.post('/unstage/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { files } = req.body;
    try {
        if (Array.isArray(files)) {
            for (const f of files) {
                await gitService.gitRemove(workspaceId, f);
            }
        }
        res.json({ message: 'Files unstaged' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git commit
router.post('/commit/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { message, authorName, authorEmail } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Commit message is required' });
    }
    try {
        const sha = await gitService.gitCommit(
            workspaceId,
            message,
            authorName || 'Colab User',
            authorEmail || 'user@colab.dev'
        );
        res.json({ sha, message: 'Committed successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git push
router.post('/push/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { token, remote, branch } = req.body;
    try {
        await gitService.gitPush(workspaceId, token, remote, branch);
        res.json({ message: 'Pushed successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git pull
router.post('/pull/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { token, remote, branch } = req.body;
    try {
        await gitService.gitPull(workspaceId, token, remote, branch);
        res.json({ message: 'Pulled successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git log
router.get('/log/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const depth = parseInt(req.query.depth as string) || 20;
    try {
        const log = await gitService.gitLog(workspaceId, depth);
        res.json(log);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git branches
router.get('/branches/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const info = await gitService.getBranches(workspaceId);
        res.json(info);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git checkout
router.post('/checkout/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { branch } = req.body;
    if (!branch) {
        return res.status(400).json({ error: 'Branch name is required' });
    }
    try {
        await gitService.gitCheckout(workspaceId, branch);
        res.json({ message: `Switched to branch ${branch}` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git create branch
router.post('/branch/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { branch, checkout } = req.body;
    if (!branch) {
        return res.status(400).json({ error: 'Branch name is required' });
    }
    try {
        await gitService.gitCreateBranch(workspaceId, branch, checkout !== false);
        res.json({ message: `Branch ${branch} created` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git remotes
router.get('/remotes/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const remotes = await gitService.getRemotes(workspaceId);
        res.json(remotes);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add remote
router.post('/remote/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { name, url } = req.body;
    if (!name || !url) {
        return res.status(400).json({ error: 'name and url are required' });
    }
    try {
        await gitService.addRemote(workspaceId, name, url);
        res.json({ message: `Remote ${name} added` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
