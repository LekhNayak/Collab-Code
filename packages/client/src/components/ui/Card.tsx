import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    padding?: 'none' | 'sm' | 'md' | 'lg';
    interactive?: boolean;
}

const PADDING = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6 sm:p-8' };

// One surface for every panel: a lighter gray than the canvas and a hairline. No glass, no glow.
export default function Card({ padding = 'md', interactive = false, className = '', children, ...rest }: CardProps) {
    return (
        <div className={`${interactive ? 'ui-card-interactive cursor-pointer' : 'ui-card'} ${PADDING[padding]} ${className}`} {...rest}>
            {children}
        </div>
    );
}
