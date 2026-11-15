import { useState } from 'react';
import { Check, UserX, X } from 'lucide-react';
import * as api from '../roomApi';
import { ROLE_HELP, ROLE_LABEL, type MemberRole, type RoomMember, type RoomRole } from '../roomApi';
import type { RoomAccess } from '../collab/useRoomAccess';
import { useToast } from '../contexts/toast';

const RANK: Record<RoomRole, number> = { READ: 0, COMMENT: 1, WRITE: 2, CO_OWNER: 3, OWNER: 4 };
const MEMBER_ROLES: MemberRole[] = ['WRITE', 'COMMENT', 'READ'];

// Who is in the room and what each person may do, plus the people waiting at the door. Owners and co-owners get the
// controls; everyone else just sees the list.
export default function RoomMembers({ access }: { access: RoomAccess }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const state = access.state;
    if (!state) return null;

    const roomId = state.roomId;
    const me = state.me;
    const myRank = RANK[me.role];
    const isOwner = me.role === 'OWNER';
    const waiting = state.members.filter(m => m.status === 'PENDING');
    const members = state.members.filter(m => m.status === 'ACTIVE');
    const owner = members.find(m => m.userId === state.ownerId);
    const standIn = state.actingOwnerId && state.actingOwnerId !== state.ownerId
        ? members.find(m => m.userId === state.actingOwnerId)
        : undefined;

    const run = async (action: () => Promise<unknown>, failure: string) => {
        setBusy(true);
        try {
            await action();
        } catch (err) {
            toast.error(failure, err instanceof Error ? err.message : undefined);
        } finally {
            setBusy(false);
        }
    };

    // Someone with a higher or equal rank is out of reach; the owner's own role never changes
    const rankOf = (m: RoomMember) => (m.userId === state.actingOwnerId ? RANK.OWNER : RANK[m.role]);
    const canChange = (m: RoomMember) => me.canManage && m.userId !== me.userId && m.userId !== state.ownerId && rankOf(m) < myRank;

    return (
        <div className="rbac">
            {state.actingOwnerId === null && (
                <p className="rbac-note rbac-note-warn" role="status">
                    The owner and every co-owner are away. People already here keep their access, and new requests wait until one of them is back.
                </p>
            )}
            {standIn && (
                <p className="rbac-note" role="status">
                    {owner?.online ? '' : 'The owner is away. '}{standIn.username} is acting as owner until they are back.
                </p>
            )}

            {me.canManage && (
                <section className="rbac-section" aria-labelledby="rbac-requests">
                    <div className="rbac-heading">
                        <h3 id="rbac-requests">Requests{waiting.length > 0 ? ` (${waiting.length})` : ''}</h3>
                        {waiting.length > 1 && (
                            <button
                                type="button"
                                className="rbac-link"
                                disabled={busy}
                                onClick={() => run(async () => {
                                    const { admitted } = await api.approveAll(roomId);
                                    toast.success(`Let in ${admitted} ${admitted === 1 ? 'person' : 'people'}`);
                                }, 'Could not accept everyone')}
                            >
                                Accept all
                            </button>
                        )}
                    </div>
                    {waiting.length === 0 ? (
                        <p className="rbac-empty">Nobody is waiting.</p>
                    ) : waiting.map(m => (
                        <div key={m.userId} className="rbac-row">
                            <Avatar name={m.username} />
                            <span className="rbac-name">{m.username}</span>
                            <button
                                type="button"
                                className="rbac-icon rbac-icon-accept"
                                disabled={busy}
                                aria-label={`Accept ${m.username} as ${ROLE_LABEL[state.defaultRole].toLowerCase()}`}
                                title={`Accept (${ROLE_LABEL[state.defaultRole].toLowerCase()})`}
                                onClick={() => run(() => api.approveRequest(roomId, m.userId), `Could not accept ${m.username}`)}
                            >
                                <Check size={14} aria-hidden />
                            </button>
                            <button
                                type="button"
                                className="rbac-icon rbac-icon-decline"
                                disabled={busy}
                                aria-label={`Decline ${m.username}`}
                                title="Decline"
                                onClick={() => run(() => api.rejectRequest(roomId, m.userId), `Could not decline ${m.username}`)}
                            >
                                <X size={14} aria-hidden />
                            </button>
                        </div>
                    ))}
                </section>
            )}

            <section className="rbac-section" aria-labelledby="rbac-members">
                <div className="rbac-heading"><h3 id="rbac-members">Members ({members.length})</h3></div>
                {members.map(m => {
                    const editable = canChange(m);
                    const label = m.userId === state.ownerId ? ROLE_LABEL.OWNER : ROLE_LABEL[m.role];
                    return (
                        <div key={m.userId} className="rbac-row">
                            <Avatar name={m.username} online={m.online} />
                            <span className="rbac-name">
                                {m.username}
                                {m.userId === me.userId && <span className="rbac-you"> (you)</span>}
                                <span className="sr-only">{m.online ? ', online' : ', offline'}</span>
                            </span>
                            {editable ? (
                                <>
                                    <select
                                        className="rbac-select"
                                        aria-label={`Role for ${m.username}`}
                                        value={m.role}
                                        disabled={busy}
                                        onChange={e => run(() => api.setMemberRole(roomId, m.userId, e.target.value as MemberRole | 'CO_OWNER'), `Could not change ${m.username}'s role`)}
                                    >
                                        {isOwner && <option value="CO_OWNER">{ROLE_LABEL.CO_OWNER}</option>}
                                        {/* A co-owner can't re-role another co-owner, so the list only matters for people below them */}
                                        {MEMBER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                                    </select>
                                    <button
                                        type="button"
                                        className="rbac-icon rbac-icon-decline"
                                        disabled={busy}
                                        aria-label={`Remove ${m.username} from the room`}
                                        title="Remove from the room"
                                        onClick={() => run(async () => {
                                            await api.kickMember(roomId, m.userId);
                                            toast.info(`${m.username} was removed`, 'They have to ask to join again.');
                                        }, `Could not remove ${m.username}`)}
                                    >
                                        <UserX size={14} aria-hidden />
                                    </button>
                                </>
                            ) : (
                                <span className={`rbac-badge rbac-badge-${m.userId === state.ownerId ? 'OWNER' : m.role}`}>{label}</span>
                            )}
                        </div>
                    );
                })}
            </section>

            <section className="rbac-section" aria-labelledby="rbac-default">
                <div className="rbac-heading"><h3 id="rbac-default">New people join as</h3></div>
                {isOwner ? (
                    <div className="rbac-row">
                        <select
                            className="rbac-select rbac-select-wide"
                            aria-labelledby="rbac-default"
                            value={state.defaultRole}
                            disabled={busy}
                            onChange={e => run(async () => {
                                await api.setDefaultRole(roomId, e.target.value as MemberRole);
                                toast.success('Updated', 'It applies to people accepted from now on.');
                            }, 'Could not change it')}
                        >
                            {MEMBER_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                    </div>
                ) : (
                    <p className="rbac-empty">{ROLE_LABEL[state.defaultRole]}</p>
                )}
                <p className="rbac-empty">{ROLE_HELP[(MEMBER_ROLES.includes(state.defaultRole as MemberRole) ? state.defaultRole : 'READ') as MemberRole]}.</p>
            </section>
        </div>
    );
}

function Avatar({ name, online }: { name: string; online?: boolean }) {
    return (
        <span className="rbac-avatar" aria-hidden>
            {name.charAt(0).toUpperCase()}
            {online !== undefined && <span className={`rbac-presence${online ? ' on' : ''}`} />}
        </span>
    );
}
