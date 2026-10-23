// The signed-in user as recorded in the JWT payload (the server verifies the token on every request;
// this is only for deciding what to show)

export interface TokenUser {
    id: string;
    username: string;
    role?: 'ADMIN' | 'STUDENT';
    isGuest: boolean;
}

export function getTokenUser(): TokenUser | null {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.id) return null;
        return {
            id: payload.id,
            username: payload.username || 'Anonymous',
            role: payload.role,
            isGuest: String(payload.id).startsWith('guest-'),
        };
    } catch {
        return null;
    }
}
