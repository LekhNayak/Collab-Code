import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeApi {
    theme: Theme;
    /** Switches the palette. With a point (the toggle's center) the new theme spreads out of it as a circle. */
    toggle: (origin?: { x: number; y: number }) => void;
}

export const ThemeContext = createContext<ThemeApi | null>(null);

export function useTheme(): ThemeApi {
    const api = useContext(ThemeContext);
    if (!api) throw new Error('useTheme must be used inside <ThemeProvider>');
    return api;
}
