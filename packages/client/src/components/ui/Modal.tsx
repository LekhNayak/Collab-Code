import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useEffectEvent, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

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
                    className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                >
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        aria-describedby={hasMessage ? messageId : undefined}
                        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            {icon && <div className="mb-5 flex justify-center text-5xl">{icon}</div>}
                            <h3 id={titleId} className="text-xl font-bold text-white mb-3">{title}</h3>
                            {hasMessage && <div id={messageId} className="text-white/60 leading-relaxed text-sm">{children}</div>}
                            <div className="mt-8 flex justify-end gap-3 flex-col-reverse sm:flex-row">
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
    const base = 'px-6 py-2.5 rounded-xl font-semibold text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black';
    switch (variant) {
        case 'danger': return `${base} bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500`;
        case 'success': return `${base} bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500 hover:text-black hover:border-emerald-500`;
        case 'primary': return `${base} bg-white/10 border border-white/20 text-white hover:bg-white/20`;
        case 'ghost':
        default: return `${base} border border-white/10 text-white/60 hover:bg-white/5 hover:text-white`;
    }
}
