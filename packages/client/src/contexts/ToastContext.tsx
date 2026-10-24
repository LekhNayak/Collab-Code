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
    success: { Icon: CheckCircle2, tile: 'bg-emerald-500/15 text-emerald-400', bar: 'bg-emerald-400' },
    error: { Icon: AlertCircle, tile: 'bg-red-500/15 text-red-400', bar: 'bg-red-400' },
    info: { Icon: Info, tile: 'bg-sky-500/15 text-sky-400', bar: 'bg-sky-400' },
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
            initial={{ opacity: 0, x: 48, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, scale: 0.96, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            className="pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-xl border border-white/10 bg-[#111114]/90 backdrop-blur-xl shadow-2xl p-3.5 pr-10 text-white"
        >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tile}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0 pt-0.5">
                <div className="text-sm font-semibold leading-snug">{toast.title}</div>
                {toast.message && <div className="text-xs text-white/55 mt-0.5 leading-relaxed break-words">{toast.message}</div>}
            </div>
            <button
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="absolute top-2.5 right-2.5 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
                <X size={14} />
            </button>
            {/* Time left before it closes */}
            <motion.div
                key={paused ? 'paused' : 'running'}
                className={`absolute bottom-0 left-0 h-0.5 opacity-60 ${bar}`}
                initial={{ width: '100%' }}
                animate={{ width: paused ? '100%' : '0%' }}
                transition={{ duration: paused ? 0 : toast.durationMs / 1000, ease: 'linear' }}
            />
        </motion.div>
    );
}
