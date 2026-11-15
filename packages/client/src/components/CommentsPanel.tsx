import { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import * as api from '../roomApi';
import { ROLE_LABEL, type RoomRole } from '../roomApi';
import type { RoomAccess } from '../collab/useRoomAccess';
import { useToast } from '../contexts/toast';

const RANK: Record<RoomRole, number> = { READ: 0, COMMENT: 1, WRITE: 2, CO_OWNER: 3, OWNER: 4 };
const MAX_LENGTH = 2000;

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// The room's comment thread. Everyone inside reads it; people who can comment (and above) write to it, so what a
// commenter says is visible to the whole room. Owners and co-owners can delete what people below them posted.
export default function CommentsPanel({ access }: { access: RoomAccess }) {
    const toast = useToast();
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const state = access.state;
    const comments = access.comments;

    // Stay at the newest comment
    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [comments.length]);

    if (!state) return null;
    const me = state.me;

    const roleOf = (userId: string): RoomRole | undefined => {
        const member = state.members.find(m => m.userId === userId);
        if (!member) return undefined;
        return userId === state.ownerId ? 'OWNER' : member.role;
    };

    // Judged by the author's role now. If they have since been removed their role is unknown here, so the server decides.
    const canDelete = (userId: string) => {
        if (!me.canManage || userId === me.userId) return false;
        const role = roleOf(userId);
        return role === undefined || RANK[role] < RANK[me.role];
    };

    const send = async () => {
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        try {
            await api.postComment(state.roomId, body);
            setText('');
        } catch (err) {
            toast.error('Could not post the comment', err instanceof Error ? err.message : undefined);
        } finally {
            setSending(false);
        }
    };

    const remove = async (id: string) => {
        try {
            await api.deleteComment(state.roomId, id);
        } catch (err) {
            toast.error('Could not delete the comment', err instanceof Error ? err.message : undefined);
        }
    };

    return (
        <div className="rbac-comments">
            <div ref={listRef} className="rbac-thread" role="log" aria-label="Room comments" aria-live="polite">
                {comments.length === 0 && <p className="rbac-empty rbac-empty-center">No comments yet.</p>}
                {comments.map(c => {
                    const role = roleOf(c.userId);
                    return (
                        <article key={c.id} className="rbac-comment">
                            <header>
                                <span className="rbac-comment-author">
                                    {c.username}
                                    {c.userId === me.userId && <span className="rbac-you"> (you)</span>}
                                </span>
                                {role && <span className={`rbac-badge rbac-badge-${role}`}>{ROLE_LABEL[role]}</span>}
                                <time className="rbac-comment-time" dateTime={c.createdAt}>{timeOf(c.createdAt)}</time>
                                {canDelete(c.userId) && (
                                    <button
                                        type="button"
                                        className="rbac-icon rbac-icon-decline rbac-comment-delete"
                                        aria-label={`Delete the comment by ${c.username}`}
                                        title="Delete this comment"
                                        onClick={() => remove(c.id)}
                                    >
                                        <Trash2 size={13} aria-hidden />
                                    </button>
                                )}
                            </header>
                            <p>{c.text}</p>
                        </article>
                    );
                })}
            </div>

            {me.canComment ? (
                <form
                    className="rbac-composer"
                    onSubmit={e => { e.preventDefault(); void send(); }}
                >
                    <label htmlFor="room-comment" className="sr-only">Write a comment</label>
                    <textarea
                        id="room-comment"
                        value={text}
                        maxLength={MAX_LENGTH}
                        rows={3}
                        placeholder="Write a comment for the room…"
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                void send();
                            }
                        }}
                    />
                    <button type="submit" className="rbac-send" disabled={sending || !text.trim()}>
                        <Send size={13} aria-hidden /> Send
                    </button>
                </form>
            ) : (
                <p className="rbac-note">You can read the comments here, but only people with comment or edit access can write them.</p>
            )}
        </div>
    );
}
