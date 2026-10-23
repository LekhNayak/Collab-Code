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

const RANK_STYLE = ['text-amber-300', 'text-slate-200', 'text-orange-300'];

export default function Leaderboard({ rows, problems, startsAt, highlightUserId, onSelect, selectedUserIds = [] }: LeaderboardProps) {
    if (rows.length === 0) {
        return <div className="text-white/40 text-sm py-10 text-center">No participants yet.</div>;
    }
    const start = startsAt ? new Date(startsAt).getTime() : null;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
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
                                className={`border-b border-white/5 transition-colors ${onSelect ? 'cursor-pointer hover:bg-white/5' : ''} ${highlighted ? 'bg-amber-500/10' : ''} ${selected ? 'bg-sky-500/10' : ''}`}
                            >
                                <td className={`py-2.5 px-3 font-bold ${RANK_STYLE[row.rank - 1] ?? 'text-white/60'}`}>
                                    <span className="inline-flex items-center gap-1">
                                        {row.rank <= 3 && <Trophy size={13} />}
                                        {row.rank}
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 text-white font-medium">
                                    {row.username}
                                    {highlighted && <span className="text-amber-300/80 text-xs ml-2">(you)</span>}
                                    {row.status === 'BLOCKED' && <span className="text-red-300 text-xs ml-2">blocked</span>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-white tabular-nums">{formatScore(row.total)}</td>
                                {problems.map(p => {
                                    const cell = row.problems[p.id];
                                    const full = cell && cell.score >= p.points;
                                    return (
                                        <td key={p.id} className="py-2.5 px-2 text-center tabular-nums">
                                            {cell ? (
                                                <span className={full ? 'text-emerald-300 font-semibold' : cell.score > 0 ? 'text-amber-300' : 'text-red-300/80'}>
                                                    {formatScore(cell.score)}
                                                </span>
                                            ) : (
                                                <span className="text-white/20">–</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="py-2.5 px-3 text-right text-white/50 tabular-nums">
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
