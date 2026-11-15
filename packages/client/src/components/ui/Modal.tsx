import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useEffectEvent, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { buttonClass } from './buttonStyles';

interface ModalAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'success' | 'ghost';
}

interface ModalProps {
    isOpen: boolean;
    title: string;
    icon?: React.ReactNode;
    children?: React.ReactNode;
    actions: ModalAction[]; // the last one is the main action and gets the focus
    onClose?: () => void;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Rendered into <body> above everything else, including the proctoring overlay (z-9999)
export default function Modal({ isOpen, title, icon, children, actions, onClose }: ModalProps) {
    const titleId = useId();
    const messageId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const hasMessage = children !== undefined && children !== null && children !== '';

    const close = useEffectEvent(() => onClose?.());

    // While open: Esc closes, Tab stays inside, focus starts on the main action and goes back to
    // where it was once the modal closes
    useEffect(() => {
        if (!isOpen) return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>('[data-modal-action]');
        buttons?.[buttons.length - 1]?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;
            const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
            if (items.length === 0) return;
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey ? index <= 0 : index === -1 || index === items.length - 1) {
                e.preventDefault();
                items[e.shiftKey ? items.length - 1 : 0].focus();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            previous?.focus();
        };
    }, [isOpen]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={onClose}
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={hasMessage ? messageId : undefined}
                        className="w-full max-w-md overflow-hidden rounded-xl bg-raised shadow-float"
                        initial={{ opacity: 0, scale: 0.97, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            {icon && <div className="mb-4 flex">{icon}</div>}
                            <h3 id={titleId} className="mb-1.5 text-base font-semibold text-fg">{title}</h3>
                            {hasMessage && <div id={messageId} className="text-sm leading-relaxed text-fg-2">{children}</div>}
                            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
                                {actions.map((action) => (
                                    <button key={action.label} data-modal-action onClick={action.onClick} className={actionClass(action.variant)}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body,
    );
}

function actionClass(variant?: string) {
    // Same buttons as the rest of the product (components/ui/Button)
    switch (variant) {
        case 'danger': return buttonClass('danger');
        case 'success': return buttonClass('success');
        case 'primary': return buttonClass('primary');
        case 'ghost':
        default: return buttonClass('ghost');
    }
}
