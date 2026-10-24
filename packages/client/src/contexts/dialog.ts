import type React from 'react';
import { createContext, useContext } from 'react';

// In-app replacements for window.confirm / window.alert (see DialogContext.tsx)

export type DialogTone = 'primary' | 'danger' | 'success';

export interface ConfirmOptions {
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: DialogTone;
    icon?: React.ReactNode;
}

export interface AlertOptions {
    title: string;
    message?: React.ReactNode;
    okLabel?: string;
    tone?: DialogTone;
    icon?: React.ReactNode;
}

export interface DialogApi {
    // Resolves true when confirmed; false on Cancel, Esc or a click outside
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    alert: (options: AlertOptions) => Promise<void>;
}

export const DialogContext = createContext<DialogApi | undefined>(undefined);

export function useDialog() {
    const context = useContext(DialogContext);
    if (context === undefined) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}
