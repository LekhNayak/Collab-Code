import { motion } from 'framer-motion';
import { Hourglass, Loader2, UserX, WifiOff } from 'lucide-react';
import Button from './ui/Button';
import IconTile from './ui/IconTile';
import type { RoomStatus } from '../collab/useRoomAccess';

interface RoomGateProps {
    status: Exclude<RoomStatus, 'off' | 'active'>;
    roomId: string;
    error: string;
    onRetry: () => void;
    onLeave: () => void;
}

// What someone sees instead of the editor while they are not (yet) inside the room
export default function RoomGate({ status, roomId, error, onRetry, onLeave }: RoomGateProps) {
    const content = {
        joining: {
            tone: 'neutral' as const,
            icon: <Loader2 size={22} className="animate-spin" />,
            title: 'Joining the room',
            body: roomId,
        },
        pending: {
            tone: 'accent' as const,
            icon: <Hourglass size={22} />,
            title: 'Waiting to be let in',
            body: 'The owner or a co-owner has been asked to accept you. This page opens by itself as soon as they do.',
        },
        removed: {
            tone: 'danger' as const,
            icon: <UserX size={22} />,
            title: 'You were removed from this room',
            body: 'To come back, ask to join again. Someone in charge has to accept you first.',
        },
        declined: {
            tone: 'danger' as const,
            icon: <UserX size={22} />,
            title: 'Your request was declined',
            body: 'You can ask again if you think this was a mistake.',
        },
        error: {
            tone: 'danger' as const,
            icon: <WifiOff size={22} />,
            title: 'Could not reach the room',
            body: error || 'Check your connection and try again.',
        },
    }[status];

    return (
        <main id="main-content" tabIndex={-1} className="flex h-screen w-full items-center justify-center bg-canvas p-8 focus:outline-none">
            <motion.div
                className="ui-card w-full max-w-md p-8 text-center"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
                <IconTile tone={content.tone} size={48} className="mx-auto mb-5">{content.icon}</IconTile>
                <h1 className="mb-2 text-lg font-semibold tracking-tight text-fg">{content.title}</h1>
                <p role={status === 'pending' || status === 'joining' ? 'status' : undefined} className="mb-2 text-sm leading-relaxed text-fg-2">
                    {content.body}
                </p>
                {status !== 'joining' && <p className="mb-7 font-mono text-xs text-fg-3">{roomId}</p>}
                {status !== 'joining' && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                        {status !== 'pending' && (
                            <Button variant="primary" size="lg" onClick={onRetry}>
                                {status === 'error' ? 'Try again' : 'Ask to join again'}
                            </Button>
                        )}
                        <Button variant="secondary" size="lg" onClick={onLeave}>
                            {status === 'pending' ? 'Cancel and go back' : 'Back to rooms'}
                        </Button>
                    </div>
                )}
            </motion.div>
        </main>
    );
}
