import { Router, Request, Response } from 'express';
import { gitService } from '../services/GitService';
import * as store from '../services/WorkspaceStore';
import { withLock } from '../collab/lock';
import { inWorkspace, persist, canAccessWorkspace } from '../collab/workspace';
import { openFile, flushWorkspace, liveContent, detachPaths, writeDetached, reloadFromDisk } from '../collab/persistence';
import { cloneLimiter } from '../middleware/rateLimiter';
import prisma from '../db';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

const router = Router();

async function getUserPat(req: Request): Promise<string | undefined> {
    const userId = (req as any).user?.id;
    if (!userId || userId.startsWith('guest-')) return undefined;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { githubPat: true } });
    return user?.githubPat ?? undefined;
}

// Validates the id and that this user may use the workspace (exam/contest workspaces are per-user).
// Returns an error message, or null when allowed.
function workspaceAccessError(req: Request, id: unknown): string | null {
    if (!store.isValidWorkspaceId(id)) return 'Invalid workspace id';
    if (!canAccessWorkspace(id, (req as any).user?.id)) return 'You do not have access to this workspace';
    return null;
}

router.param('workspaceId', (req, res, next, id) => {
    const error = workspaceAccessError(req, id);
    if (error) return res.status(error.startsWith('Invalid') ? 400 : 403).json({ error });
    next();
});

// Mirrors a bulk change (clone, upload, pull, checkout) into the DB after the response is sent.
// Queued on the lock, so later requests for the workspace see a consistent DB.
function persistInBackground(workspaceId: string) {
    withLock(workspaceId, () => store.syncDiskToDb(workspaceId))
        .catch(err => console.error(`[Store] Failed to persist ${workspaceId}:`, err));
}

const errorStatus = (error: any) => (/not found/i.test(error.message) ? 404 : 500);

// Clone a repository
router.post('/clone', cloneLimiter, async (req: Request, res: Response) => {
    const { repoUrl, workspaceId } = req.body;
    if (!repoUrl || !workspaceId) {
        return res.status(400).json({ error: 'repoUrl and workspaceId are required' });
    }
    const accessError = workspaceAccessError(req, workspaceId);
    if (accessError) {
        return res.status(accessError.startsWith('Invalid') ? 400 : 403).json({ error: accessError });
    }
    try {
        await inWorkspace(workspaceId, () => gitService.cloneRepository(repoUrl, workspaceId));
        persistInBackground(workspaceId);
        res.status(200).json({ message: 'Repository cloned successfully' });
    } catch (error: any) {
        const status = /already contains files/.test(error.message) ? 409 : 500;
        res.status(status).json({ error: error.message || 'Failed to clone repository' });
    }
});

// Initialize empty workspace
router.post('/init', async (req: Request, res: Response) => {
    const { workspaceId } = req.body;
    if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
    }
    const accessError = workspaceAccessError(req, workspaceId);
    if (accessError) {
        return res.status(accessError.startsWith('Invalid') ? 400 : 403).json({ error: accessError });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            const seeded = gitService.initWorkspace(workspaceId);
            if (seeded) {
                const buf = fs.readFileSync(gitService.resolveFilePath(workspaceId, seeded));
                await persist(workspaceId, () => store.upsertFile(workspaceId, seeded, buf));
            }
        });
        res.status(200).json({ message: 'Workspace initialized' });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to init workspace' });
    }
});

// Get file tree for a workspace
router.get('/tree/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const tree = await inWorkspace(workspaceId, () => gitService.getFileTree(workspaceId));
        res.status(200).json(tree);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to retrieve file tree' });
    }
});

// Load a file into the workspace's live collaborative doc. The content reaches the editor over
// the WebSocket; this only makes the server put it there (once, so clients can't race to seed it).
router.post('/open/:workspaceId/*', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        const result = await inWorkspace(workspaceId, () => openFile(workspaceId, filePath));
        if (!result.ok) return res.status(result.status).json({ error: result.error });
        res.status(200).json({ path: store.normalizePath(filePath) });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Save pending editor changes now (Ctrl+S). `saved` is false if something couldn't be persisted.
router.post('/flush/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const saved = await inWorkspace(workspaceId, () => flushWorkspace(workspaceId));
        res.status(200).json({ saved });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Read a file (the live editor content if the file is open)
router.get('/file/:workspaceId/*', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0]; // wildcard param
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        const content = await inWorkspace(workspaceId, () =>
            liveContent(workspaceId, filePath) ?? gitService.readFile(workspaceId, filePath));
        res.status(200).json({ content, path: filePath });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

// Save/update a file
router.put('/file/:workspaceId/*', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    const { content } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    if (typeof content !== 'string') {
        return res.status(400).json({ error: 'content is required' });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            gitService.writeFile(workspaceId, filePath, content);
            reloadFromDisk(workspaceId);
            await persist(workspaceId, () => store.upsertFile(workspaceId, filePath, Buffer.from(content, 'utf-8')));
        });
        res.status(200).json({ message: 'File saved', path: filePath });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new file or directory
router.post('/file/:workspaceId/*', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    const { isDirectory, content } = req.body;
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            gitService.createFile(workspaceId, filePath, !!isDirectory, content);
            if (!isDirectory) {
                await persist(workspaceId, () => store.upsertFile(workspaceId, filePath, Buffer.from(content || '', 'utf-8')));
            }
        });
        res.status(201).json({ message: 'Created', path: filePath });
    } catch (error: any) {
        const status = error.message.includes('Already exists') ? 409 : 500;
        res.status(status).json({ error: error.message });
    }
});

// Delete a file or directory
router.delete('/file/:workspaceId/*', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const filePath = (req.params as any)[0];
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            gitService.deleteFile(workspaceId, filePath);
            detachPaths(workspaceId, filePath);
            await persist(workspaceId, () => store.deletePrefix(workspaceId, filePath));
        });
        res.status(200).json({ message: 'Deleted', path: filePath });
    } catch (error: any) {
        res.status(errorStatus(error)).json({ error: error.message });
    }
});

// Rename/move a file
router.patch('/file/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
        return res.status(400).json({ error: 'oldPath and newPath are required' });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            // Take the files out of the live doc first, keeping edits that weren't saved yet
            const unsaved = detachPaths(workspaceId, oldPath);
            try {
                gitService.renameFile(workspaceId, oldPath, newPath);
            } catch (err) {
                writeDetached(workspaceId, unsaved, oldPath, oldPath);
                throw err;
            }
            const rewritten = writeDetached(workspaceId, unsaved, oldPath, newPath);
            await persist(workspaceId, async () => {
                await store.renamePrefix(workspaceId, oldPath, newPath);
                for (const p of rewritten) {
                    await store.upsertFile(workspaceId, p, fs.readFileSync(gitService.resolveFilePath(workspaceId, p)));
                }
            });
        });
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
        await inWorkspace(workspaceId, () => gitService.gitInit(workspaceId));
        res.json({ message: 'Git repository initialized' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git status
router.get('/status/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const result = await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            const isRepo = gitService.isGitRepo(workspaceId);
            const status = isRepo ? await gitService.getStatus(workspaceId) : [];
            const branchInfo = isRepo ? await gitService.getBranches(workspaceId) : { branches: [], current: '' };
            const remotes = isRepo ? await gitService.getRemotes(workspaceId) : [];
            return { isRepo, status, branch: branchInfo.current, branches: branchInfo.branches, remotes };
        });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git add (stage files)
router.post('/add/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { files } = req.body; // string[] or 'all'
    if (files !== 'all' && !Array.isArray(files)) {
        return res.status(400).json({ error: 'files must be an array or "all"' });
    }
    try {
        await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            if (files === 'all') {
                await gitService.gitAddAll(workspaceId);
            } else {
                for (const f of files) {
                    await gitService.gitAdd(workspaceId, f);
                }
            }
        });
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
        await inWorkspace(workspaceId, async () => {
            if (Array.isArray(files)) {
                for (const f of files) {
                    await gitService.gitRemove(workspaceId, f);
                }
            }
        });
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
        const sha = await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            return gitService.gitCommit(
                workspaceId,
                message,
                authorName || 'Colab User',
                authorEmail || 'user@colab.dev'
            );
        });
        res.json({ sha, message: 'Committed successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git push — uses PAT stored in user profile (set via /auth/github-credentials)
router.post('/push/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { remote, branch } = req.body;
    try {
        const pat = await getUserPat(req);
        if (!pat) {
            return res.status(403).json({ error: 'GitHub credentials not set up. Go to the Hub and connect your GitHub account first.' });
        }
        await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            await gitService.gitPush(workspaceId, pat, remote, branch);
        });
        res.json({ message: 'Pushed successfully' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git pull — uses PAT stored in user profile (set via /auth/github-credentials)
router.post('/pull/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    const { remote, branch } = req.body;
    try {
        const pat = await getUserPat(req);
        if (!pat) {
            return res.status(403).json({ error: 'GitHub credentials not set up. Go to the Hub and connect your GitHub account first.' });
        }
        await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            await gitService.gitPull(workspaceId, pat, remote, branch);
            reloadFromDisk(workspaceId);
        });
        persistInBackground(workspaceId);
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
        const log = await inWorkspace(workspaceId, () => gitService.gitLog(workspaceId, depth));
        res.json(log);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git branches
router.get('/branches/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const info = await inWorkspace(workspaceId, () => gitService.getBranches(workspaceId));
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
        await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            await gitService.gitCheckout(workspaceId, branch);
            reloadFromDisk(workspaceId);
        });
        persistInBackground(workspaceId);
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
        await inWorkspace(workspaceId, async () => {
            await flushWorkspace(workspaceId);
            await gitService.gitCreateBranch(workspaceId, branch, checkout !== false);
            reloadFromDisk(workspaceId);
        });
        res.json({ message: `Branch ${branch} created` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Git remotes
router.get('/remotes/:workspaceId', async (req: Request, res: Response) => {
    const { workspaceId } = req.params;
    try {
        const remotes = await inWorkspace(workspaceId, () => gitService.getRemotes(workspaceId));
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
        await inWorkspace(workspaceId, () => gitService.addRemote(workspaceId, name, url));
        res.json({ message: `Remote ${name} added` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============== Directory / ZIP Upload ================

const multerAny: any = multer;

const storage = multerAny.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        const uploadDir = path.join(process.cwd(), 'uploads_tmp');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req: any, file: any, cb: any) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 200 }, // 10 MB per file, max 200 files
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

            const uploaded = await inWorkspace(workspaceId, async () => {
                await flushWorkspace(workspaceId);

                // diskStorage writes to 'path', not 'buffer'
                const fileData = fs.readFileSync((zipFile as any).path);
                const zip = new AdmZip(fileData);
                const entries = zip.getEntries();
                let count = 0;

                // Detect common top-level folder so we can strip it (matches folder-upload behaviour)
                const allEntryNames = entries.map(e => e.entryName.replace(/\\/g, '/'));
                const firstSegments = new Set(allEntryNames.map(n => n.split('/')[0]));
                const hasSingleRoot = firstSegments.size === 1 && !allEntryNames.some(n => !n.includes('/'));
                const rootPrefix = hasSingleRoot ? ([...firstSegments][0] + '/') : '';

                for (const entry of entries) {
                    // Skip directories, Mac hidden files, and dot-files
                    if (entry.isDirectory) continue;
                    const rawName = entry.entryName.replace(/\\/g, '/');
                    if (rawName.includes('__MACOSX') || path.basename(rawName).startsWith('.')) continue;

                    // Strip common root folder (e.g. myproject/src/index.js → src/index.js)
                    const stripped = rootPrefix && rawName.startsWith(rootPrefix)
                        ? rawName.slice(rootPrefix.length)
                        : rawName;
                    if (!stripped) continue;

                    // Zip Slip Prevention
                    const relativePath = path.normalize(stripped).replace(/^(\.\.(\/|\\|$))+/, '');
                    if (!relativePath || path.isAbsolute(relativePath)) continue;

                    const buffer = entry.getData();
                    gitService.writeFileRaw(workspaceId, relativePath, buffer);
                    count++;
                }

                reloadFromDisk(workspaceId);
                return count;
            });

            persistInBackground(workspaceId);
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

            const uploaded = await inWorkspace(workspaceId, async () => {
                await flushWorkspace(workspaceId);
                let count = 0;

                for (let i = 0; i < folderFiles.length; i++) {
                    const file = folderFiles[i];
                    const relativePath = relPaths[i] || file.originalname;

                    // Strip top-level folder from webkitRelativePath
                    const parts = relativePath.replace(/\\/g, '/').split('/');
                    const strippedPath = parts.length > 1 ? parts.slice(1).join('/') : relativePath;
                    if (!strippedPath) continue;

                    // Skip hidden/system files
                    if (path.basename(strippedPath).startsWith('.')) continue;

                    // diskStorage means we must read from path
                    const fileData = fs.readFileSync((file as any).path);
                    gitService.writeFileRaw(workspaceId, strippedPath, fileData);

                    // Cleanup tmp file
                    fs.unlinkSync((file as any).path);

                    count++;
                }

                reloadFromDisk(workspaceId);
                return count;
            });

            console.log('[UPLOAD][folder] Completed upload', {
                workspaceId,
                uploaded,
            });

            persistInBackground(workspaceId);
            res.json({ uploaded, message: `Uploaded ${uploaded} files` });

        } else {
            res.status(400).json({ error: 'Invalid mode. Use "zip" or "folder"' });
        }
    } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    } finally {
        // Master cleanup of tmp zip
        if (mode === 'zip') {
            const zipFile = files?.find(f => f.fieldname === 'file');
            if (zipFile && (zipFile as any).path && fs.existsSync((zipFile as any).path)) {
                fs.unlinkSync((zipFile as any).path);
            }
        }
    }
});

// Download a file, folder, or the entire workspace as a ZIP
router.get('/download/:workspaceId', async (req: Request, res: Response) => {
    try {
        const { workspaceId } = req.params;
        const filePath = req.query.path as string;

        const result = await inWorkspace(workspaceId, async () => {
            // Include edits the autosave hasn't written yet
            await flushWorkspace(workspaceId);

            let targetPath = gitService.getWorkspacePath(workspaceId);
            let zipName = `${workspaceId}.zip`;

            if (filePath) {
                const cleanPath = filePath.replace(/^\//, '');
                targetPath = gitService.resolveFilePath(workspaceId, cleanPath);
                zipName = `${path.basename(targetPath)}.zip`;
            }

            if (!fs.existsSync(targetPath)) return null;
            if (fs.statSync(targetPath).isFile()) return { file: targetPath };

            // It's a directory, zip it
            const zip = new AdmZip();
            zip.addLocalFolder(targetPath);
            return { zipName, zipBuffer: zip.toBuffer() };
        });

        if (!result) {
            return res.status(404).json({ error: 'Path not found' });
        }
        if ('file' in result) {
            return res.download(result.file as string);
        }

        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${result.zipName}"`);
        res.send(result.zipBuffer);
    } catch (error: any) {
        console.error('Download error:', error);
        res.status(500).json({ error: error.message || 'Download failed' });
    }
});

export default router;
