import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface BrutalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    className?: string;
}

export default function BrutalInput({ label, className = '', onFocus, onBlur, ...props }: BrutalInputProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <motion.label
                    className="font-black text-sm uppercase tracking-wider text-neo-text"
                    animate={isFocused ? { x: 2 } : { x: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    {label}
                </motion.label>
            )}
            <motion.input
                className="w-full bg-neo-surface text-neo-text border-2 border-neo-border px-4 py-3 outline-none placeholder:text-neo-text-secondary"
                style={{ boxShadow: isFocused ? '4px 4px 0px 0px var(--neo-shadow)' : 'none' }}
                animate={isFocused ? { x: -2, y: -2 } : { x: 0, y: 0 }}
                transition={{ duration: 0.15 }}
                onFocus={(e) => {
                    setIsFocused(true);
                    onFocus?.(e);
                }}
                onBlur={(e) => {
                    setIsFocused(false);
                    onBlur?.(e);
                }}
                {...(props as any)}
            />
        </div>
    );
}
