import { Router, Request, Response } from 'express';
import { GitService } from '../services/GitService';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';

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

// ============== Directory / ZIP Upload ================

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB per file
});

router.post('/upload/:workspaceId', upload.any(), async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const mode = req.body.mode as string;

    if (!mode) {
        return res.status(400).json({ error: 'mode is required (zip or folder)' });
    }

    const files = (req as any).files as Array<{ fieldname: string; originalname: string; buffer: Buffer; mimetype: string; size: number }>;

    // Basic request diagnostics to help debug upload issues
    console.log('[UPLOAD] Incoming request', {
        workspaceId,
        mode,
        totalFiles: files?.length || 0,
        fieldnames: files?.map(f => f.fieldname) || [],
    });

    try {
        if (mode === 'zip') {
            const zipFile = files?.find(f => f.fieldname === 'file');
            if (!zipFile) {
                return res.status(400).json({ error: 'No zip file uploaded' });
            }

            const zip = new AdmZip(zipFile.buffer);
            const entries = zip.getEntries();
            let uploaded = 0;

            for (const entry of entries) {
                // Skip directories, Mac hidden files, and dot-files
                if (entry.isDirectory) continue;
                const entryName = entry.entryName;
                if (entryName.includes('__MACOSX') || path.basename(entryName).startsWith('.')) continue;

                // Strip the top-level directory name from the entry path so files
                // land at workspace root (e.g. "myproject/src/app.ts" → "src/app.ts")
                const parts = entryName.split('/');
                const relativePath = parts.length > 1 ? parts.slice(1).join('/') : entryName;
                if (!relativePath) continue;

                const buffer = entry.getData();
                gitService.writeFileRaw(workspaceId, relativePath, buffer);
                uploaded++;
            }

            res.json({ uploaded, message: `Extracted ${uploaded} files from zip` });

        } else if (mode === 'folder') {
            let folderFiles = files?.filter(f => f.fieldname === 'files') || [];

            // If nothing matched "files", fall back to all files so we don't silently drop them.
            if ((!folderFiles || folderFiles.length === 0) && files && files.length > 0) {
                console.warn('[UPLOAD][folder] No files with fieldname "files"; falling back to all files.', {
                    totalFiles: files.length,
                    fieldnames: files.map(f => f.fieldname),
                });
                folderFiles = files;
            }

            // paths[] is sent as a JSON array or repeated field values
            let rawPaths = req.body.paths;
            const relPaths: string[] = Array.isArray(rawPaths)
                ? rawPaths
                : rawPaths ? [rawPaths] : [];

            if (folderFiles.length === 0) {
                console.warn('[UPLOAD][folder] Request contained no files after processing.');
                return res.status(400).json({ error: 'No files uploaded' });
            }

            let uploaded = 0;

            for (let i = 0; i < folderFiles.length; i++) {
                const file = folderFiles[i];
                const relativePath = relPaths[i] || file.originalname;

                // Strip top-level folder from webkitRelativePath (e.g. "myproject/src/app.ts" → "src/app.ts")
                const parts = relativePath.replace(/\\/g, '/').split('/');
                const strippedPath = parts.length > 1 ? parts.slice(1).join('/') : relativePath;
                if (!strippedPath) continue;

                // Skip hidden/system files
                if (path.basename(strippedPath).startsWith('.')) continue;

                gitService.writeFileRaw(workspaceId, strippedPath, file.buffer);
                uploaded++;
            }

            console.log('[UPLOAD][folder] Completed upload', {
                workspaceId,
                uploaded,
            });

            res.json({ uploaded, message: `Uploaded ${uploaded} files` });

        } else {
            res.status(400).json({ error: 'Invalid mode. Use "zip" or "folder"' });
        }
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});

export default router;
