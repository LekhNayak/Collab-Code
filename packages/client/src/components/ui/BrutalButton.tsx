import React from 'react';
import { motion } from 'framer-motion';

interface BrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function BrutalButton({
    children,
    variant = 'secondary',
    className = '',
    size = 'md',
    disabled,
    ...props
}: BrutalButtonProps) {
    const baseClasses = "font-bold border-2 border-neo-border flex items-center justify-center gap-2 relative overflow-hidden select-none";

    const variants: Record<string, string> = {
        primary: "bg-neo-accent text-neo-accent-text",
        secondary: "bg-neo-surface text-neo-text",
        danger: "bg-neo-error text-white border-neo-border",
        ghost: "bg-transparent text-neo-text border-transparent shadow-none hover:shadow-none",
    };

    const sizes: Record<string, string> = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg"
    };

    const disabledClasses = disabled
        ? "opacity-50 cursor-not-allowed"
        : "cursor-pointer";

    return (
        <motion.button
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
            style={{ boxShadow: disabled ? 'none' : '4px 4px 0px 0px var(--neo-shadow)' }}
            whileHover={disabled ? {} : {
                x: -2,
                y: -2,
                boxShadow: '6px 6px 0px 0px var(--neo-shadow)',
                transition: { duration: 0.15 }
            }}
            whileTap={disabled ? {} : {
                x: 4,
                y: 4,
                boxShadow: '0px 0px 0px 0px var(--neo-shadow)',
                transition: { duration: 0.1 }
            }}
            disabled={disabled}
            {...(props as any)}
        >
            {children}
        </motion.button>
    );
}
