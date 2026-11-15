import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PagerProps {
    /** Zero-based current page */
    page: number;
    pageSize: number;
    total: number;
    onChange: (page: number) => void;
    className?: string;
}

// "1–5 of 12" with a step either side. Renders nothing when everything fits on one page, so a short list
// never grows controls it doesn't need.
export default function Pager({ page, pageSize, total, onChange, className = '' }: PagerProps) {
    const pageCount = Math.ceil(total / pageSize);
    if (pageCount <= 1) return null;
    const current = Math.min(page, pageCount - 1);
    const from = current * pageSize + 1;
    const to = Math.min(total, (current + 1) * pageSize);
    const step = 'inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-2 transition-colors hover:bg-tint-2 hover:text-fg active:scale-90 disabled:pointer-events-none disabled:opacity-30';

    return (
        <div className={`inline-flex items-center gap-0.5 text-xs text-fg-2 ${className}`} role="navigation" aria-label="Pagination">
            <button type="button" className={step} disabled={current === 0} onClick={() => onChange(current - 1)} aria-label="Previous page">
                <ChevronLeft size={15} />
            </button>
            <span className="min-w-[5.5rem] text-center tabular-nums">{from}–{to} of {total}</span>
            <button type="button" className={step} disabled={current >= pageCount - 1} onClick={() => onChange(current + 1)} aria-label="Next page">
                <ChevronRight size={15} />
            </button>
        </div>
    );
}
