import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <motion.button
            onClick={toggleTheme}
            className="p-2 border-2 border-neo-border bg-neo-surface text-neo-text flex items-center justify-center rounded-none relative overflow-hidden"
            style={{ boxShadow: '2px 2px 0px 0px var(--neo-shadow)' }}
            whileHover={{
                x: -2,
                y: -2,
                boxShadow: '4px 4px 0px 0px var(--neo-shadow)',
            }}
            whileTap={{
                x: 2,
                y: 2,
                boxShadow: '0px 0px 0px 0px var(--neo-shadow)',
            }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <AnimatePresence mode="wait" initial={false}>
                {theme === 'light' ? (
                    <motion.div
                        key="moon"
                        initial={{ rotate: -90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Moon size={20} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ rotate: 90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: -90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Sun size={20} />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.button>
    );
}
