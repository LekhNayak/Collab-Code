import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * What a full-screen overlay owes a keyboard and screen-reader user: it is announced as a dialog, focus moves into it,
 * Tab stays inside, Esc closes it, and focus goes back to where it came from. Spread `props` on the overlay panel.
 * (Modal in this folder does the same for the confirm dialogs.)
 */
export function useDialogPanel<T extends HTMLElement>(label: string, onClose: () => void) {
    const ref = useRef<T>(null);

    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const panel = ref.current;
        // Start on the first control; fall back to the panel itself so Esc and Tab still work
        const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel)?.focus({ preventScroll: true });
        return () => previous?.focus({ preventScroll: true });
    }, []);

    const onKeyDown = (e: KeyboardEvent<T>) => {
        const panel = ref.current;
        // A confirm dialog opened from inside this one renders in a portal but its events still bubble here
        if (!panel || !panel.contains(e.target as Node)) return;
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
            return;
        }
        if (e.key !== 'Tab') return;
        const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (items.length === 0) {
            e.preventDefault();
            return;
        }
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey ? index <= 0 : index === items.length - 1) {
            e.preventDefault();
            items[e.shiftKey ? items.length - 1 : 0].focus();
        }
    };

    return {
        ref,
        props: { ref, role: 'dialog' as const, 'aria-modal': true as const, 'aria-label': label, tabIndex: -1, onKeyDown },
    };
}
