import { useEffect, useState } from 'react';
import { type WebsocketProvider } from 'y-websocket';

interface User {
    name: string;
    color: string;
    clientId: number;
}

interface UserPresenceProps {
    provider: WebsocketProvider | null;
    currentUser: string;
}

export default function UserPresence({ provider, currentUser }: UserPresenceProps) {
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        if (!provider) return;

        const updateUsers = () => {
            const states = provider.awareness.getStates();
            const userList: User[] = [];

            states.forEach((state, clientId) => {
                if (state.user) {
                    userList.push({
                        name: state.user.name || 'Anonymous',
                        color: state.user.color || '#969696',
                        clientId,
                    });
                }
            });

            setUsers(userList);
        };

        provider.awareness.on('change', updateUsers);
        updateUsers();

        return () => {
            provider.awareness.off('change', updateUsers);
        };
    }, [provider]);

    return (
        <div className="user-presence">
            <div className="presence-header">
                <span>Connected Users ({users.length})</span>
            </div>
            <div className="presence-list">
                {users.map((user) => (
                    <div key={user.clientId} className="presence-user">
                        <div
                            className="presence-avatar"
                            style={{ background: user.color }}
                        >
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="presence-name">
                            {user.name}
                            {user.name === currentUser && (
                                <span className="presence-you"> (you)</span>
                            )}
                        </span>
                        <span className="presence-dot" style={{ background: user.color }} />
                    </div>
                ))}
            </div>
        </div>
    );
}
