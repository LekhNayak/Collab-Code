import React from 'react';

interface BrutalCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverable?: boolean;
}

export default function BrutalCard({ children, className = '', onClick, hoverable = false }: BrutalCardProps) {
    const baseClasses = "bg-neo-surface border-2 border-neo-border shadow-brutal p-6";
    const hoverClasses = hoverable ? "transition-all cursor-pointer hover:-translate-y-1 hover:-translate-x-1 hover:shadow-brutal-hover active:translate-y-1 active:translate-x-1 active:shadow-none" : "";

    return (
        <div
            className={`${baseClasses} ${hoverClasses} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}
