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
    const baseClasses = "font-black border-4 border-neo-border flex items-center justify-center gap-2 relative overflow-hidden select-none";

    const variants: Record<string, string> = {
        primary: "bg-neo-accent text-neo-accent-text tracking-wide",
        secondary: "bg-neo-surface text-neo-text tracking-wide",
        danger: "bg-neo-error text-white tracking-wide",
        ghost: "bg-transparent text-neo-text border-transparent shadow-none hover:shadow-none tracking-wide",
    };

    const sizes: Record<string, string> = {
        sm: "px-4 py-2 text-sm",
        md: "px-8 py-4 text-base",
        lg: "px-10 py-5 text-xl"
    };

    const disabledClasses = disabled
        ? "opacity-50 cursor-not-allowed"
        : "cursor-pointer";

    return (
        <motion.button
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
            style={{ boxShadow: disabled ? 'none' : '6px 6px 0px 0px var(--neo-shadow)' }}
            whileHover={disabled ? {} : {
                x: -3,
                y: -3,
                boxShadow: '9px 9px 0px 0px var(--neo-shadow)',
                transition: { duration: 0.15 }
            }}
            whileTap={disabled ? {} : {
                x: 6,
                y: 6,
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
