import { useCallback, useEffect, useState } from 'react';

// Countdowns use the server's clock: every contest response carries `serverNow`, and the offset
// between it and the browser clock corrects for a wrong local time.
export function useServerClock(tickMs = 1000) {
    const [offset, setOffset] = useState(0);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), tickMs);
        return () => clearInterval(timer);
    }, [tickMs]);

    const sync = useCallback((serverNow: string | undefined) => {
        if (!serverNow) return;
        const server = new Date(serverNow).getTime();
        if (!Number.isNaN(server)) setOffset(server - Date.now());
    }, []);

    return { now: now + offset, sync };
}

export const msUntil = (iso: string | null | undefined, now: number) => (iso ? new Date(iso).getTime() - now : 0);

// Current time (server-corrected by offsetMs), re-rendering every tick. Keep it in small components
// such as <Countdown> so a whole page doesn't re-render every second.
export function useNow(offsetMs = 0, tickMs = 1000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), tickMs);
        return () => clearInterval(timer);
    }, [tickMs]);
    return now + offsetMs;
}
