import type { KeyboardEvent } from 'react';

// Props that make a non-button element behave like one for the keyboard: focusable, announced as a button, and
// activated by Enter or Space (WCAG 2.1.1, 4.1.2). Prefer a real <button>; this is for rows whose layout or styles
// are already built around a div. Pass `expanded` for a disclosure header.
export function buttonProps(onActivate: () => void, expanded?: boolean) {
    return {
        role: 'button' as const,
        tabIndex: 0,
        'aria-expanded': expanded,
        onClick: onActivate,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
            // A control inside the row keeps its own keys
            if (e.target !== e.currentTarget) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
            }
        },
    };
}
