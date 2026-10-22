// Session management service — stores sessions in Postgres (IdeSession table), so open tabs and
// installed extensions survive an ephemeral disk. Sessions written by the earlier JSON-file
// version are imported once by importLegacySessions().

import fs from 'fs';
import path from 'path';
import prisma from '../db';

export interface SessionExtension {
    extensionId: string;
    installedAt: string;
    config?: Record<string, any>;
}

export interface Session {
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

const LEGACY_SESSIONS_DIR = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'sessions')
    : path.join(process.cwd(), 'sessions');

export class SessionService {
    private async write(session: Session): Promise<Session> {
        session.updatedAt = new Date().toISOString();
        await prisma.ideSession.upsert({
            where: { id: session.id },
            create: { id: session.id, owner: session.owner, data: session as any },
            update: { owner: session.owner, data: session as any },
        });
        return session;
    }

    // ---- Create ----
    async createSession(name: string, roomId: string, workspaceId: string, owner: string): Promise<Session> {
        const id = roomId; // use roomId as session ID for simplicity
        const session: Session = {
            id,
            name,
            roomId,
            workspaceId,
            owner,
            openTabs: [],
            activeTab: '',
            settings: {},
            extensions: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        return this.write(session);
    }

    // ---- Get by ID ----
    async getSession(id: string): Promise<Session | null> {
        const row = await prisma.ideSession.findUnique({ where: { id } });
        return row ? (row.data as unknown as Session) : null;
    }

    // ---- List all ----
    async listSessions(owner?: string): Promise<Session[]> {
        const rows = await prisma.ideSession.findMany({
            where: owner ? { owner } : undefined,
            orderBy: { updatedAt: 'desc' },
        });
        return rows.map(r => r.data as unknown as Session);
    }

    // ---- Update (save state) ----
    async updateSession(id: string, updates: Partial<Pick<Session, 'name' | 'openTabs' | 'activeTab' | 'settings' | 'extensions'>>): Promise<Session | null> {
        const session = await this.getSession(id);
        if (!session) return null;

        if (updates.name !== undefined) session.name = updates.name;
        if (updates.openTabs !== undefined) session.openTabs = updates.openTabs;
        if (updates.activeTab !== undefined) session.activeTab = updates.activeTab;
        if (updates.settings !== undefined) session.settings = { ...session.settings, ...updates.settings };
        if (updates.extensions !== undefined) session.extensions = updates.extensions;

        return this.write(session);
    }

    // ---- Delete ----
    async deleteSession(id: string): Promise<boolean> {
        const { count } = await prisma.ideSession.deleteMany({ where: { id } });
        return count > 0;
    }

    // ---- Extension management ----
    async installExtension(sessionId: string, extensionId: string, config?: Record<string, any>): Promise<Session | null> {
        const session = await this.getSession(sessionId);
        if (!session) return null;

        // Check if already installed
        if (session.extensions.some(e => e.extensionId === extensionId)) {
            return session; // already installed
        }

        session.extensions.push({
            extensionId,
            installedAt: new Date().toISOString(),
            config,
        });
        return this.write(session);
    }

    async uninstallExtension(sessionId: string, extensionId: string): Promise<Session | null> {
        const session = await this.getSession(sessionId);
        if (!session) return null;

        session.extensions = session.extensions.filter(e => e.extensionId !== extensionId);
        return this.write(session);
    }
}

// Imports sessions saved as JSON files by earlier versions; existing rows are left alone
export async function importLegacySessions(): Promise<void> {
    if (!fs.existsSync(LEGACY_SESSIONS_DIR)) return;
    const data: Array<{ id: string; owner: string; data: any }> = [];
    for (const f of fs.readdirSync(LEGACY_SESSIONS_DIR).filter(f => f.endsWith('.json'))) {
        try {
            const session: Session = JSON.parse(fs.readFileSync(path.join(LEGACY_SESSIONS_DIR, f), 'utf-8'));
            if (session.id) data.push({ id: session.id, owner: session.owner || 'anonymous', data: session });
        } catch {
            // skip corrupt files
        }
    }
    if (data.length === 0) return;
    const { count } = await prisma.ideSession.createMany({ data, skipDuplicates: true });
    if (count > 0) console.log(`[Sessions] Imported ${count} legacy session file(s) into the database`);
}
