import { Router, Request, Response } from 'express';
import { SessionService } from '../services/sessionService';
import { getAllExtensions, getExtension, getExtensionsByCategory, addCustomExtension, deleteCustomExtension } from '../services/extensionRegistry';

const router = Router();
const sessionService = new SessionService();

// ============== Extensions Registry ==============

// List all available extensions (built-in + custom)
router.get('/extensions', (_req: Request, res: Response) => {
    const exts = getAllExtensions();
    res.json(exts);
});

// Get extensions by category
router.get('/extensions/category/:category', (req: Request, res: Response) => {
    const exts = getExtensionsByCategory(req.params.category as any);
    res.json(exts);
});

// Get single extension
router.get('/extensions/:id', (req: Request, res: Response) => {
    const ext = getExtension(req.params.id);
    if (!ext) return res.status(404).json({ error: 'Extension not found' });
    res.json(ext);
});

// ============== Custom Extensions ==============

// Create a custom extension
router.post('/extensions/custom', async (req: Request, res: Response) => {
    const { id, name, description, category, icon, author, version, config } = req.body;
    if (!id || !name || !category) {
        return res.status(400).json({ error: 'id, name, and category are required' });
    }
    // Check for ID collision
    const existing = getExtension(id);
    if (existing) {
        return res.status(409).json({ error: 'Extension with this ID already exists' });
    }
    try {
        const ext = await addCustomExtension({
            id, name, description: description || '', category,
            icon: icon || '🧩', author: author || 'Custom', version: version || '1.0.0', config,
        });
        res.status(201).json(ext);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a custom extension
router.delete('/extensions/custom/:id', async (req: Request, res: Response) => {
    try {
        const deleted = await deleteCustomExtension(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Custom extension not found' });
        res.json({ message: 'Custom extension deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============== Sessions ==============

// Create a session
router.post('/', async (req: Request, res: Response) => {
    const { name, roomId, workspaceId, owner } = req.body;
    if (!name || !roomId) {
        return res.status(400).json({ error: 'name and roomId are required' });
    }
    try {
        const session = await sessionService.createSession(
            name,
            roomId,
            workspaceId || roomId,
            owner || 'anonymous'
        );
        res.status(201).json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// List all sessions
router.get('/', async (req: Request, res: Response) => {
    try {
        const owner = req.query.owner as string | undefined;
        const sessions = await sessionService.listSessions(owner);
        res.json(sessions);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get session by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const session = await sessionService.getSession(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update (save) session
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { name, openTabs, activeTab, settings, extensions } = req.body;
        const session = await sessionService.updateSession(req.params.id, {
            name, openTabs, activeTab, settings, extensions,
        });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete session
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const deleted = await sessionService.deleteSession(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Session not found' });
        res.json({ message: 'Session deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Install extension to session
router.post('/:id/extensions', async (req: Request, res: Response) => {
    const { extensionId } = req.body;
    if (!extensionId) {
        return res.status(400).json({ error: 'extensionId is required' });
    }
    // Validate extension exists
    const ext = getExtension(extensionId);
    if (!ext) return res.status(404).json({ error: 'Extension not found in registry' });

    try {
        // Auto-include the extension's config from the registry
        const session = await sessionService.installExtension(req.params.id, extensionId, ext.config);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Uninstall extension from session
router.delete('/:id/extensions/:extensionId', async (req: Request, res: Response) => {
    try {
        const session = await sessionService.uninstallExtension(req.params.id, req.params.extensionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json(session);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
