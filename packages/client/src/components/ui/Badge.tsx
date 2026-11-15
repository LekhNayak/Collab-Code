import React from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';

const TONES: Record<BadgeTone, string> = {
    neutral: 'bg-tint-2 text-fg',
    accent: 'bg-accent/15 text-accent-text',
    success: 'bg-success/15 text-success-text',
    danger: 'bg-danger/15 text-danger-text',
    warning: 'bg-warning/15 text-warning-text',
};

interface BadgeProps {
    tone?: BadgeTone;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}

export default function Badge({ tone = 'neutral', dot = false, children, className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ${dot ? 'pl-1.5' : ''} ${TONES[tone]} ${className}`}>
            {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {children}
        </span>
    );
}
