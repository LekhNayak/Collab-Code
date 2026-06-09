// Session management service — stores sessions as JSON files
// Avoids database migration requirement

import fs from 'fs';
import path from 'path';

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

export class SessionService {
    private sessionsDir: string;

    constructor() {
        this.sessionsDir = process.env.DATA_DIR
            ? path.join(process.env.DATA_DIR, 'sessions')
            : path.join(process.cwd(), 'sessions');
        if (!fs.existsSync(this.sessionsDir)) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }

    private getSessionPath(id: string): string {
        return path.join(this.sessionsDir, `${id}.json`);
    }

    // ---- Create ----
    createSession(name: string, roomId: string, workspaceId: string, owner: string): Session {
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
        fs.writeFileSync(this.getSessionPath(id), JSON.stringify(session, null, 2));
        return session;
    }

    // ---- Get by ID ----
    getSession(id: string): Session | null {
        const filePath = this.getSessionPath(id);
        if (!fs.existsSync(filePath)) return null;
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }

    // ---- List all ----
    listSessions(owner?: string): Session[] {
        if (!fs.existsSync(this.sessionsDir)) return [];
        const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
        const sessions: Session[] = [];
        for (const f of files) {
            try {
                const data = fs.readFileSync(path.join(this.sessionsDir, f), 'utf-8');
                const session: Session = JSON.parse(data);
                if (!owner || session.owner === owner) {
                    sessions.push(session);
                }
            } catch {
                // skip corrupt files
            }
        }
        return sessions.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }

    // ---- Update (save state) ----
    updateSession(id: string, updates: Partial<Pick<Session, 'name' | 'openTabs' | 'activeTab' | 'settings' | 'extensions'>>): Session | null {
        const session = this.getSession(id);
        if (!session) return null;

        if (updates.name !== undefined) session.name = updates.name;
        if (updates.openTabs !== undefined) session.openTabs = updates.openTabs;
        if (updates.activeTab !== undefined) session.activeTab = updates.activeTab;
        if (updates.settings !== undefined) session.settings = { ...session.settings, ...updates.settings };
        if (updates.extensions !== undefined) session.extensions = updates.extensions;
        session.updatedAt = new Date().toISOString();

        fs.writeFileSync(this.getSessionPath(id), JSON.stringify(session, null, 2));
        return session;
    }

    // ---- Delete ----
    deleteSession(id: string): boolean {
        const filePath = this.getSessionPath(id);
        if (!fs.existsSync(filePath)) return false;
        fs.unlinkSync(filePath);
        return true;
    }

    // ---- Extension management ----
    installExtension(sessionId: string, extensionId: string, config?: Record<string, any>): Session | null {
        const session = this.getSession(sessionId);
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
        session.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.getSessionPath(sessionId), JSON.stringify(session, null, 2));
        return session;
    }

    uninstallExtension(sessionId: string, extensionId: string): Session | null {
        const session = this.getSession(sessionId);
        if (!session) return null;

        session.extensions = session.extensions.filter(e => e.extensionId !== extensionId);
        session.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.getSessionPath(sessionId), JSON.stringify(session, null, 2));
        return session;
    }
}
