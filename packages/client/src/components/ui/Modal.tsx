import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

interface ModalAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'ghost';
}

interface ModalProps {
    isOpen: boolean;
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    actions: ModalAction[];
    onClose?: () => void;
}

export default function Modal({ isOpen, title, icon, children, actions, onClose }: ModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            {icon && <div className="mb-5 flex justify-center text-5xl">{icon}</div>}
                            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                            <div className="text-white/60 mb-8 leading-relaxed text-sm">{children}</div>
                            <div className="flex justify-end gap-3 flex-col-reverse sm:flex-row">
                                {actions.map((action) => (
                                    <button key={action.label} onClick={action.onClick} className={actionClass(action.variant)}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function actionClass(variant?: string) {
    const base = 'px-6 py-2.5 rounded-xl font-semibold text-sm transition-all';
    switch (variant) {
        case 'danger': return `${base} bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500`;
        case 'primary': return `${base} bg-white/10 border border-white/20 text-white hover:bg-white/20`;
        case 'ghost':
        default: return `${base} border border-white/10 text-white/60 hover:bg-white/5 hover:text-white`;
    }
}
