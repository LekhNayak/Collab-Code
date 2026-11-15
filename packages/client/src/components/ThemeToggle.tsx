import { useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../contexts/theme';

// The sun and moon are one object turning: the outgoing glyph rolls away as the incoming one rolls in,
// while the page itself is revealed in a circle from this button (ThemeContext).
export default function ThemeToggle({ className = '', variant = 'ghost' }: { className?: string; variant?: 'ghost' | 'bare' }) {
    const { theme, toggle } = useTheme();
    const ref = useRef<HTMLButtonElement>(null);
    const next = theme === 'dark' ? 'light' : 'dark';

    const onClick = () => {
        const box = ref.current?.getBoundingClientRect();
        toggle(box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : undefined);
    };

    const base = variant === 'ghost'
        ? 'h-9 w-9 rounded-lg text-fg-2 hover:bg-tint-2 hover:text-fg active:scale-90'
        : '';

    return (
        <button
            ref={ref}
            type="button"
            onClick={onClick}
            title={`Switch to ${next} mode`}
            aria-label={`Switch to ${next} mode`}
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden transition-[color,background-color,transform] duration-150 ${base} ${className}`}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={theme}
                    className="inline-flex"
                    initial={{ rotate: -70, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 70, opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.28, ease: [0.25, 0.8, 0.25, 1] }}
                >
                    {theme === 'dark' ? <Sun size={variant === 'bare' ? 22 : 16} /> : <Moon size={variant === 'bare' ? 22 : 16} />}
                </motion.span>
            </AnimatePresence>
        </button>
    );
}
