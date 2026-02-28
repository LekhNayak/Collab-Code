import React from 'react';

interface BrutalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    className?: string;
}

export default function BrutalInput({ label, className = '', ...props }: BrutalInputProps) {
    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && <label className="font-bold text-neo-text">{label}</label>}
            <input
                className="w-full bg-neo-surface text-neo-text border-2 border-neo-border px-4 py-3 outline-none focus:shadow-brutal transition-shadow"
                {...props}
            />
        </div>
    );
}
