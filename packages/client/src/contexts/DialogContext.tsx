import React, { useCallback, useMemo, useState } from 'react';
import Modal from '../components/ui/Modal';
import { DialogContext, type AlertOptions, type ConfirmOptions, type DialogApi, type DialogTone } from './dialog';

interface PendingDialog {
    id: number;
    kind: 'confirm' | 'alert';
    options: ConfirmOptions | AlertOptions;
    resolve: (value: boolean) => void;
}

const ICON_TILE: Record<DialogTone, string> = {
    primary: 'bg-white/10 border-white/15 text-white',
    danger: 'bg-red-500/15 border-red-500/30 text-red-400',
    success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
};

let nextId = 0;

// Shows one dialog at a time; dialogs requested meanwhile wait their turn
export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [queue, setQueue] = useState<PendingDialog[]>([]);
    // Keeps the closing dialog's content on screen during its exit animation
    const [last, setLast] = useState<PendingDialog | null>(null);
    const current = queue[0] ?? null;
    const shown = current ?? last;

    const open = useCallback((kind: PendingDialog['kind'], options: PendingDialog['options']) =>
        new Promise<boolean>(resolve => {
            const id = ++nextId;
            setQueue(q => [...q, { id, kind, options, resolve }]);
        }), []);

    const api = useMemo<DialogApi>(() => ({
        confirm: options => open('confirm', options),
        alert: options => open('alert', options).then(() => undefined),
    }), [open]);

    const settle = (value: boolean) => {
        if (!current) return;
        current.resolve(value);
        setLast(current);
        setQueue(q => (q[0] === current ? q.slice(1) : q)); // ignore a second click on the same dialog
    };

    const tone = shown?.options.tone ?? 'primary';
    const actions = shown?.kind === 'confirm'
        ? [
            { label: (shown.options as ConfirmOptions).cancelLabel ?? 'Cancel', variant: 'ghost' as const, onClick: () => settle(false) },
            { label: (shown.options as ConfirmOptions).confirmLabel ?? 'Confirm', variant: tone, onClick: () => settle(true) },
        ]
        : [{ label: (shown?.options as AlertOptions | undefined)?.okLabel ?? 'OK', variant: tone, onClick: () => settle(true) }];

    return (
        <DialogContext.Provider value={api}>
            {children}
            <Modal
                key={shown?.id} // a fresh modal per dialog, so each one takes the focus when it opens
                isOpen={!!current}
                title={shown?.options.title ?? ''}
                icon={shown?.options.icon && (
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${ICON_TILE[tone]}`}>{shown.options.icon}</div>
                )}
                actions={actions}
                onClose={() => settle(false)}
            >
                {shown?.options.message}
            </Modal>
        </DialogContext.Provider>
    );
}
