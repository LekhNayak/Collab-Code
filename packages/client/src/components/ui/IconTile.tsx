import React from 'react';

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
    neutral: 'bg-tint-2 text-fg',
    accent: 'bg-accent/15 text-accent-text',
    success: 'bg-success/15 text-success-text',
    danger: 'bg-danger/15 text-danger-text',
    warning: 'bg-warning/15 text-warning-text',
};

// A soft square behind an icon (a dialog or empty-state header). Icons come from lucide, never emoji.
export default function IconTile({ tone = 'neutral', size = 40, children, className = '' }: {
    tone?: Tone;
    size?: 32 | 40 | 48;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`flex shrink-0 items-center justify-center rounded-lg ${TONES[tone]} ${className}`}
            style={{ width: size, height: size }}
        >
            {children}
        </div>
    );
}
