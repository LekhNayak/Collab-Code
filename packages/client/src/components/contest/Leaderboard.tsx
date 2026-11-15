import { Trophy } from 'lucide-react';
import { formatDuration, formatScore, type LeaderboardProblem, type LeaderboardRow } from '../../contestApi';

interface LeaderboardProps {
    rows: LeaderboardRow[];
    problems: LeaderboardProblem[];
    startsAt: string | null;
    highlightUserId?: string | null;
    onSelect?: (row: LeaderboardRow) => void;
    selectedUserIds?: string[];
}

const RANK_STYLE = ['text-accent-text', 'text-fg', 'text-accent-text'];

export default function Leaderboard({ rows, problems, startsAt, highlightUserId, onSelect, selectedUserIds = [] }: LeaderboardProps) {
    if (rows.length === 0) {
        return <div className="text-fg-3 text-sm py-10 text-center">No participants yet.</div>;
    }
    const start = startsAt ? new Date(startsAt).getTime() : null;
    return (
        <div className="min-w-0">
            <table className="w-full text-sm">
                <thead className="sticky top-0 z-[1] bg-surface">
                    <tr className="text-fg-3 text-xs border-b border-line">
                        <th className="text-left font-semibold py-2.5 px-3 w-14">#</th>
                        <th className="text-left font-semibold py-2.5 px-3">Participant</th>
                        <th className="text-right font-semibold py-2.5 px-3">Score</th>
                        {problems.map(p => (
                            <th key={p.id} className="text-center font-semibold py-2.5 px-2" title={`${p.title} (${p.points} pts)`}>{p.index}</th>
                        ))}
                        <th className="text-right font-semibold py-2.5 px-3" title="Time when the current score was reached">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const highlighted = row.userId === highlightUserId;
                        const selected = selectedUserIds.includes(row.userId);
                        return (
                            <tr
                                key={row.userId}
                                onClick={onSelect ? () => onSelect(row) : undefined}
                                className={`border-b border-line-faint transition-colors ${onSelect ? 'cursor-pointer hover:bg-tint-1' : ''} ${highlighted ? 'bg-accent/10' : ''} ${selected ? 'bg-accent/10' : ''}`}
                            >
                                <td className={`py-2.5 px-3 font-semibold ${RANK_STYLE[row.rank - 1] ?? 'text-fg-2'}`}>
                                    <span className="inline-flex items-center gap-1">
                                        {row.rank <= 3 && <Trophy size={13} />}
                                        {row.rank}
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 text-fg font-medium">
                                    {row.username}
                                    {highlighted && <span className="text-accent-text/80 text-xs ml-2">(you)</span>}
                                    {row.status === 'BLOCKED' && <span className="text-danger-text text-xs ml-2">blocked</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-fg tabular-nums">{formatScore(row.total)}</td>
                                {problems.map(p => {
                                    const cell = row.problems[p.id];
                                    const full = cell && cell.score >= p.points;
                                    return (
                                        <td key={p.id} className="py-2.5 px-2 text-center tabular-nums">
                                            {cell ? (
                                                <span className={full ? 'text-success-text font-semibold' : cell.score > 0 ? 'text-accent-text' : 'text-danger-text/80'}>
                                                    {formatScore(cell.score)}
                                                </span>
                                            ) : (
                                                <span className="text-fg-3">–</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="py-2.5 px-3 text-right text-fg-3 tabular-nums">
                                    {row.reachedAt && start !== null ? formatDuration(new Date(row.reachedAt).getTime() - start) : '–'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
