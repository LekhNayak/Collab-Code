// Who may do what with a contest, and in which phase

import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { Contest, ContestParticipant } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../../db';

export type Phase = 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED';

export function phaseOf(contest: { startsAt: Date | null; endsAt: Date | null }, now = new Date()): Phase {
    if (!contest.startsAt || !contest.endsAt) return 'DRAFT';
    if (now < contest.startsAt) return 'SCHEDULED';
    if (now < contest.endsAt) return 'LIVE';
    return 'ENDED';
}

// Thrown by route code and turned into a JSON error. Never 401: the client logs the user out on 401.
export class HttpError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

// Wraps an async route handler so HttpErrors become JSON responses
export const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
    try {
        await fn(req, res);
    } catch (error: any) {
        if (error instanceof HttpError) {
            res.status(error.status).json({ error: error.message });
        } else {
            console.error('[Contests]', error);
            res.status(500).json({ error: error.message || 'Something went wrong' });
        }
    }
};

export interface ContestUser {
    id: string;
    username: string;
}

// Contests need a real account: guests have no User row to attach participation or submissions to
export function requireAccount(req: Request): ContestUser {
    const user = (req as any).user;
    if (!user?.id || String(user.id).startsWith('guest-')) {
        throw new HttpError(403, 'Contests need an account. Log in or register to continue.');
    }
    return { id: user.id, username: user.username };
}

export async function findContest(id: string): Promise<Contest> {
    const contest = await prisma.contest.findUnique({ where: { id } });
    if (!contest) throw new HttpError(404, 'Contest not found');
    return contest;
}

// The contest, if the caller owns it
export async function loadOwned(req: Request, id: string): Promise<{ contest: Contest; user: ContestUser }> {
    const user = requireAccount(req);
    const contest = await findContest(id);
    if (contest.ownerId !== user.id) throw new HttpError(403, 'Only the organizer can do this');
    return { contest, user };
}

export interface ContestAccess {
    contest: Contest;
    user: ContestUser;
    isOwner: boolean;
    participant: ContestParticipant | null;
    phase: Phase;
}

export async function loadAccess(req: Request, id: string): Promise<ContestAccess> {
    const user = requireAccount(req);
    const contest = await findContest(id);
    const isOwner = contest.ownerId === user.id;
    const participant = isOwner
        ? null
        : await prisma.contestParticipant.findUnique({ where: { contestId_userId: { contestId: id, userId: user.id } } });
    return { contest, user, isOwner, participant, phase: phaseOf(contest) };
}

// Participants may work on problems only while the contest is live and they're in good standing.
// The organizer can always run and submit (to test their own problems) but never shows up in rankings.
export function assertCanCompete(access: ContestAccess) {
    if (access.isOwner) return;
    if (!access.participant) throw new HttpError(403, 'Join the contest first');
    if (access.participant.status === 'BLOCKED') {
        throw new HttpError(403, access.participant.blockedReason || 'You have been blocked from this contest');
    }
    if (access.participant.status === 'REMOVED') throw new HttpError(403, 'You have been removed from this contest');
    if (access.phase === 'DRAFT' || access.phase === 'SCHEDULED') throw new HttpError(403, 'The contest has not started yet');
    if (access.phase === 'ENDED') throw new HttpError(403, 'The contest has ended');
}

// Problems are visible to participants once the contest starts (and stay visible afterwards)
export function assertCanSeeProblems(access: ContestAccess) {
    if (access.isOwner) return;
    if (!access.participant) throw new HttpError(403, 'Join the contest first');
    if (access.participant.status === 'REMOVED') throw new HttpError(403, 'You have been removed from this contest');
    if (access.phase === 'DRAFT' || access.phase === 'SCHEDULED') throw new HttpError(403, 'The contest has not started yet');
}

// Workspace holding a user's code for a contest
export const contestWorkspaceId = (contest: { code: string }, userId: string) => `${contest.code}__${userId}`;

const newCode = () => `CT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Creates a row with a fresh unique contest code, retrying on the (unlikely) collision
export async function withUniqueCode<T>(create: (code: string) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await create(newCode());
        } catch (error) {
            const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
            if (!collision || attempt >= 4) throw error;
        }
    }
}
