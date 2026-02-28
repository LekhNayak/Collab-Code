import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 border-2 border-neo-border bg-neo-surface text-neo-text shadow-brutal-sm hover:shadow-brutal transition-all hover:-translate-y-0.5 active:translate-y-0 active:translate-x-0 active:shadow-none flex items-center justify-center rounded-none"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
    );
}
