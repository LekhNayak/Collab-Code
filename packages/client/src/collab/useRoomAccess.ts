// Where this person stands in a collab room, kept live.
//
// Entering a room asks the server to join it. The first time that only files a request, which the owner or a
// co-owner answers; after that the person walks straight back in until they are removed. While waiting or inside, a
// second WebSocket (the "control channel", separate from the document socket) pushes everything that changes:
// admissions, role changes, removals, who is online, and new comments.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WS_BASE } from '../config';
import * as api from '../roomApi';
import type { RoomComment, RoomState } from '../roomApi';

export type RoomStatus =
    | 'off'        // not a collab room (an exam, or no room at all): no rules apply
    | 'joining'    // asking the server
    | 'error'      // could not reach it
    | 'pending'    // waiting for the owner or a co-owner to let us in
    | 'active'     // inside
    | 'removed'    // taken out of the room
    | 'declined';  // the request was turned down

export interface RoomAccess {
    status: RoomStatus;
    error: string;
    state: RoomState | null;
    comments: RoomComment[];
    canWrite: boolean;
    canComment: boolean;
    canManage: boolean;
    /** Ask again after being removed or declined, or retry after a connection error */
    retry: () => void;
}

const RECONNECT_MAX_MS = 10000;

// What the server pushes on the control channel
type ControlMessage =
    | { type: 'state'; state: RoomState }
    | { type: 'comment'; comment: RoomComment }
    | { type: 'comment-deleted'; id: string }
    | { type: 'kicked' }
    | { type: 'rejected' };

export function useRoomAccess(roomId: string | undefined, displayName: string, enabled: boolean): RoomAccess {
    const [state, setState] = useState<RoomState | null>(null);
    const [comments, setComments] = useState<RoomComment[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [outcome, setOutcome] = useState<'removed' | 'declined' | null>(null);
    const [attempt, setAttempt] = useState(0);

    const active = !!roomId && enabled;

    // Ask to be let in (or straight in, for people who already were)
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        api.joinRoom(roomId!, displayName)
            .then(next => {
                if (cancelled) return;
                setState(next);
                setError('');
                setLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Could not reach the server');
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [active, roomId, displayName, attempt]);

    const myStatus = state?.me.status;
    const listening = active && !outcome && (myStatus === 'PENDING' || myStatus === 'ACTIVE');

    // The control channel: reconnects by itself, and reloads the thread each time it connects so nothing is missed
    useEffect(() => {
        if (!listening) return;
        let closed = false;
        let socket: WebSocket | null = null;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let tries = 0;

        const loadComments = () => api.getComments(roomId!).then(list => !closed && setComments(list)).catch(() => {});

        const connect = () => {
            const token = encodeURIComponent(localStorage.getItem('token') || '');
            socket = new WebSocket(`${WS_BASE}/${encodeURIComponent(roomId!)}?mode=collab-control&token=${token}`);
            socket.onopen = () => {
                tries = 0;
                void loadComments();
            };
            socket.onmessage = (event) => {
                let message: ControlMessage;
                try { message = JSON.parse(event.data); } catch { return; }
                switch (message.type) {
                    case 'state': setState(message.state); break;
                    case 'comment': setComments(list => (list.some(c => c.id === message.comment.id) ? list : [...list, message.comment])); break;
                    case 'comment-deleted': setComments(list => list.filter(c => c.id !== message.id)); break;
                    case 'kicked': setOutcome('removed'); break;
                    case 'rejected': setOutcome('declined'); break;
                }
            };
            socket.onclose = (event) => {
                if (closed) return;
                if (event.code === 4003) { setOutcome(o => o ?? 'removed'); return; }
                timer = setTimeout(connect, Math.min(1000 * 2 ** tries++, RECONNECT_MAX_MS));
            };
        };

        connect();
        return () => {
            closed = true;
            clearTimeout(timer);
            socket?.close();
        };
    }, [listening, roomId]);

    const retry = useCallback(() => {
        setOutcome(null);
        setState(null); // forget the old standing so it can't flash while we ask again
        setError('');
        setLoading(true);
        setAttempt(n => n + 1);
    }, []);

    return useMemo<RoomAccess>(() => {
        if (!active) return { status: 'off', error: '', state: null, comments: [], canWrite: true, canComment: true, canManage: false, retry };
        let status: RoomStatus;
        if (outcome) status = outcome;
        else if (!state) status = loading ? 'joining' : 'error';
        else if (state.me.status === 'ACTIVE') status = 'active';
        else if (state.me.status === 'KICKED') status = 'removed';
        else status = 'pending';
        const me = state?.me;
        return {
            status,
            error,
            state,
            comments,
            canWrite: status === 'active' && !!me?.canWrite,
            canComment: status === 'active' && !!me?.canComment,
            canManage: status === 'active' && !!me?.canManage,
            retry,
        };
    }, [active, outcome, state, loading, error, comments, retry]);
}
