import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { ThemeContext, type Theme, type ThemeApi } from './theme';

const STORAGE_KEY = 'theme';
const REVEAL_MS = 700;

// index.html sets the attribute before first paint; this reads it back so React starts in the same theme
function initialTheme(): Theme {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // storage blocked: fall through to the system preference
    }
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function paint(theme: Theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111113' : '#f6f5f4');
    try {
        localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // the choice just won't be remembered
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>(initialTheme);

    useEffect(() => {
        paint(theme);
    }, [theme]);

    const toggle = useCallback((origin?: { x: number; y: number }) => {
        const next: Theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        const root = document.documentElement;
        const swap = () => {
            paint(next);
            flushSync(() => setTheme(next));
        };

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!document.startViewTransition || reduced) {
            swap();
            return;
        }

        // The new palette is revealed by a circle growing from the toggle until it covers the farthest corner
        const x = origin?.x ?? window.innerWidth / 2;
        const y = origin?.y ?? window.innerHeight / 2;
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

        root.classList.add('theme-switching');
        const transition = document.startViewTransition(swap);
        transition.ready
            .then(() => {
                root.animate(
                    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                    { duration: REVEAL_MS, easing: 'cubic-bezier(0.65, 0, 0.1, 1)', pseudoElement: '::view-transition-new(root)' },
                );
            })
            .catch(() => {});
        transition.finished.finally(() => root.classList.remove('theme-switching'));
    }, []);

    const api = useMemo<ThemeApi>(() => ({ theme, toggle }), [theme, toggle]);
    return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}
