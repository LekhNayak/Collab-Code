import { formatDuration } from '../../contestApi';
import { msUntil, useNow } from '../../contest/clock';

// Time left until `target`, using the server-corrected clock
export default function Countdown({ target, offsetMs, className = '' }: { target: string | null; offsetMs: number; className?: string }) {
    const now = useNow(offsetMs);
    return <span className={`tabular-nums ${className}`}>{formatDuration(msUntil(target, now))}</span>;
}
