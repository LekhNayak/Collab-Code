import type React from 'react';
import { createContext, useContext } from 'react';

// Bottom-right notifications shown after an action finishes (see ToastContext.tsx)

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
    title: string;
    message?: React.ReactNode;
    tone?: ToastTone;
    durationMs?: number;
}

export interface ToastApi {
    show: (options: ToastOptions) => void;
    success: (title: string, message?: React.ReactNode) => void;
    error: (title: string, message?: React.ReactNode) => void;
    info: (title: string, message?: React.ReactNode) => void;
}

export const ToastContext = createContext<ToastApi | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
