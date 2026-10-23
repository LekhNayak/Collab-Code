// Contest standings. A participant's score for a problem is their best finished submission; the total is
// the sum. Ties go to whoever reached their current total first (by submission time, so judge delays
// never change the order).

import prisma from '../../db';

export interface LeaderboardRow {
    rank: number;
    userId: string;
    username: string;
    status: string;
    total: number;
    reachedAt: string | null;
    problems: Record<string, { score: number; at: string }>; // by problem id
}

interface RawRow {
    userId: string;
    username: string;
    status: string;
    total: number | null;
    reachedAt: Date | null;
    problems: Record<string, { score: number; at: string }> | null;
}

const CACHE_MS = 5000;
const cache = new Map<string, { at: number; rows: LeaderboardRow[] }>();

export function invalidateLeaderboard(contestId: string) {
    cache.delete(contestId);
}

export async function getLeaderboard(contest: { id: string; endsAt: Date | null }): Promise<LeaderboardRow[]> {
    const cached = cache.get(contest.id);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.rows;

    // Submissions made after the end (allowed for nobody but the organizer) never count
    const endsAt = contest.endsAt ?? new Date('9999-12-31');
    const raw = await prisma.$queryRaw<RawRow[]>`
        WITH best AS (
            SELECT DISTINCT ON (s."userId", s."problemId") s."userId", s."problemId", s.score, s."createdAt"
            FROM "Submission" s
            WHERE s."contestId" = ${contest.id} AND s.status = 'DONE' AND s."createdAt" < ${endsAt}
            ORDER BY s."userId", s."problemId", s.score DESC, s."createdAt" ASC
        )
        SELECT p."userId", u.username, p.status::text AS status,
               COALESCE(SUM(b.score), 0)::float8 AS total,
               MAX(b."createdAt") FILTER (WHERE b.score > 0) AS "reachedAt",
               COALESCE(
                   json_object_agg(b."problemId", json_build_object('score', b.score, 'at', b."createdAt"))
                       FILTER (WHERE b."problemId" IS NOT NULL),
                   '{}'
               ) AS problems
        FROM "ContestParticipant" p
        JOIN "User" u ON u.id = p."userId"
        LEFT JOIN best b ON b."userId" = p."userId"
        WHERE p."contestId" = ${contest.id} AND p.status <> 'REMOVED'
        GROUP BY p."userId", u.username, p.status
        ORDER BY total DESC, "reachedAt" ASC NULLS LAST, u.username ASC`;

    let rank = 0;
    let previous: RawRow | null = null;
    const rows = raw.map((row, i) => {
        const total = Number(row.total ?? 0);
        // Equal total and equal time share a rank
        const tied = previous && Number(previous.total ?? 0) === total
            && (previous.reachedAt?.getTime() ?? null) === (row.reachedAt?.getTime() ?? null);
        if (!tied) rank = i + 1;
        previous = row;
        return {
            rank,
            userId: row.userId,
            username: row.username,
            status: row.status,
            total,
            reachedAt: row.reachedAt ? row.reachedAt.toISOString() : null,
            problems: row.problems ?? {},
        };
    });
    cache.set(contest.id, { at: Date.now(), rows });
    return rows;
}
