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
    const border = tone === 'good' ? '' : tone === 'bad' ? '' : 'border-line';
    return (
        <div className={`rounded-lg border ${border} bg-canvas overflow-hidden`}>
            {title && (
                <div className="px-3 py-1.5 text-[11px] font-semibold text-fg-3 border-b border-line flex justify-between gap-3">
                    <span className="truncate">{title}</span>
                    <span className="normal-case tracking-normal font-normal text-fg-3 shrink-0">{total} row{total === 1 ? '' : 's'}</span>
                </div>
            )}
            <div className="overflow-auto" style={{ maxHeight }}>
                <table className="w-full text-xs font-mono border-collapse">
                    <thead className="sticky top-0 bg-surface">
                        <tr>
                            {table.columns.map((column, i) => (
                                <th key={i} className="text-left font-semibold text-fg-2 px-3 py-1.5 border-b border-line whitespace-nowrap">{column}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.rows.map((row, r) => (
                            <tr key={r} className="odd:bg-tint-1">
                                {row.map((value, c) => (
                                    <td key={c} className="px-3 py-1 whitespace-nowrap text-fg border-b border-line-faint">{renderValue(value)}</td>
                                ))}
                            </tr>
                        ))}
                        {table.rows.length === 0 && (
                            <tr><td colSpan={Math.max(1, table.columns.length)} className="px-3 py-2 text-fg-3 italic">No rows</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {total > table.rows.length && (
                <div className="px-3 py-1.5 text-[11px] text-fg-3 border-t border-line">Showing the first {table.rows.length} of {total} rows</div>
            )}
        </div>
    );
}

function renderValue(value: SqlValue) {
    if (value === null) return <span className="text-fg-3 italic">NULL</span>;
    if (typeof value === 'number') return <span className="text-accent-text">{value}</span>;
    if (value === '') return <span className="text-fg-3">''</span>;
    return value;
}
