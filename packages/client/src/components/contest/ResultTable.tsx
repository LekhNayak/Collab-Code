import type React from 'react';
import type { SqlTable, SqlValue } from '../../contestApi';

// Compact grid for SQL problems: query results, expected results and dataset tables
export default function ResultTable({ table, title, maxHeight = 260, tone = 'normal' }: {
    table: SqlTable;
    title?: React.ReactNode;
    maxHeight?: number;
    tone?: 'normal' | 'good' | 'bad';
}) {
    const total = table.totalRows ?? table.rows.length;
    const border = tone === 'good' ? 'border-emerald-500/30' : tone === 'bad' ? 'border-red-500/30' : 'border-white/10';
    return (
        <div className={`rounded-lg border ${border} bg-black/40 overflow-hidden`}>
            {title && (
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/50 border-b border-white/10 flex justify-between gap-3">
                    <span className="truncate">{title}</span>
                    <span className="normal-case tracking-normal font-normal text-white/35 shrink-0">{total} row{total === 1 ? '' : 's'}</span>
                </div>
            )}
            <div className="overflow-auto" style={{ maxHeight }}>
                <table className="w-full text-xs font-mono border-collapse">
                    <thead className="sticky top-0 bg-[#151515]">
                        <tr>
                            {table.columns.map((column, i) => (
                                <th key={i} className="text-left font-semibold text-white/60 px-3 py-1.5 border-b border-white/10 whitespace-nowrap">{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, r) => (
                            <tr key={r} className="odd:bg-white/[0.02]">
                                {row.map((value, c) => (
                                    <td key={c} className="px-3 py-1 whitespace-nowrap text-white/85 border-b border-white/[0.04]">{renderValue(value)}</td>
                                ))}
                            </tr>
                        ))}
                        {table.rows.length === 0 && (
                            <tr><td colSpan={Math.max(1, table.columns.length)} className="px-3 py-2 text-white/35 italic">No rows</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {total > table.rows.length && (
                <div className="px-3 py-1.5 text-[11px] text-white/40 border-t border-white/10">Showing the first {table.rows.length} of {total} rows</div>
            )}
        </div>
    );
}

function renderValue(value: SqlValue) {
    if (value === null) return <span className="text-white/30 italic">NULL</span>;
    if (typeof value === 'number') return <span className="text-sky-200">{value}</span>;
    if (value === '') return <span className="text-white/30">''</span>;
    return value;
}
