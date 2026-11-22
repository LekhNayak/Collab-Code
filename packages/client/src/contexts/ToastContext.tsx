import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type ToastApi, type ToastOptions, type ToastTone } from './toast';

interface Toast {
    id: number;
    title: string;
    message?: React.ReactNode;
    tone: ToastTone;
    durationMs: number;
}

const MAX_TOASTS = 4;
const DEFAULT_DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 4000, error: 6000 };
const TONE = {
    success: { Icon: CheckCircle2, tile: 'bg-success/15 text-success-text', bar: 'bg-success' },
    error: { Icon: AlertCircle, tile: 'bg-danger/15 text-danger-text', bar: 'bg-danger' },
    info: { Icon: Info, tile: 'bg-accent/15 text-accent-text', bar: 'bg-accent' },
};

let nextId = 0;

// Toasts live above every page (and every dialog), so one shown right before navigating stays visible
export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

    const show = useCallback((options: ToastOptions) => {
        const tone = options.tone ?? 'info';
        const toast: Toast = {
            id: ++nextId,
            title: options.title,
            message: options.message,
            tone,
            durationMs: options.durationMs ?? DEFAULT_DURATION_MS[tone],
        };
        setToasts(list => [...list, toast].slice(-MAX_TOASTS));
    }, []);

    const api = useMemo<ToastApi>(() => ({
        show,
        success: (title, message) => show({ title, message, tone: 'success' }),
        error: (title, message) => show({ title, message, tone: 'error' }),
        info: (title, message) => show({ title, message, tone: 'info' }),
    }), [show]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            {createPortal(
                <div
                    role="region"
                    aria-label="Notifications"
                    className="fixed bottom-4 right-4 z-[10001] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))] pointer-events-none"
                >
                    <AnimatePresence initial={false}>
                        {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
                    </AnimatePresence>
                </div>,
                document.body,
            )}
        </ToastContext.Provider>
    );
}

// Dismisses itself after its duration; hovering pauses it (the countdown restarts on leave)
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
    const [paused, setPaused] = useState(false);
    const { Icon, tile, bar } = TONE[toast.tone];

    useEffect(() => {
        if (paused) return;
        const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
        return () => clearTimeout(timer);
    }, [paused, toast.id, toast.durationMs, onDismiss]);

    return (
        <motion.div
            layout
            role={toast.tone === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className="pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl bg-raised p-3 pr-10 text-fg shadow-float"
        >
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${tile}`}>
                <Icon size={16} />
            </div>
            <div className="min-w-0 pt-0.5">
                <div className="text-[13px] font-medium leading-snug">{toast.title}</div>
                {toast.message && <div className="text-xs text-fg-2 mt-0.5 leading-relaxed break-words">{toast.message}</div>}
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="absolute right-1.5 top-1.5 inline-flex h-[28px] w-[28px] items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-tint-3 hover:text-fg"
            >
                <X size={14} />
            </button>
            {/* Time left before it closes */}
            <motion.div
                aria-hidden
                key={paused ? 'paused' : 'running'}
                className={`absolute bottom-0 left-0 h-0.5 opacity-60 ${bar}`}
                initial={{ width: '100%' }}
                animate={{ width: paused ? '100%' : '0%' }}
                transition={{ duration: paused ? 0 : toast.durationMs / 1000, ease: 'linear' }}
            />
        </motion.div>
    );
}
