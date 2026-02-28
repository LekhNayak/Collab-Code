import React from 'react';

interface BrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export default function BrutalButton({
    children,
    variant = 'secondary',
    className = '',
    size = 'md',
    ...props
}: BrutalButtonProps) {
    const baseClasses = "font-bold border-2 border-neo-border transition-all active:translate-y-1 active:shadow-none hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brutal-hover shadow-brutal flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-neo-accent text-neo-border",
        secondary: "bg-neo-surface text-neo-text",
        danger: "bg-neo-error text-white border-neo-border hover:text-white"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-6 py-3 text-base",
        lg: "px-8 py-4 text-lg"
    };

    return (
        <button
            className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
