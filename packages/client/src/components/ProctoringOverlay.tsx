import { motion, AnimatePresence } from 'framer-motion';
import { Lock, AlertTriangle } from 'lucide-react';
import type { ProctoringOverlayState } from '../hooks/useProctoring';
import IconTile from './ui/IconTile';
import Button from './ui/Button';
import { useDialogPanel } from './ui/useDialog';

const noop = () => {};

// Full-screen warning shown after leaving fullscreen or switching tabs during a proctored session
export default function ProctoringOverlay({ overlay, onDismiss, label = 'exam', maxStrikes = 3 }: {
    overlay: ProctoringOverlayState;
    onDismiss: () => void;
    label?: string;      // "exam", "contest"
    maxStrikes?: number;
}) {
    return (
        <AnimatePresence>
            {overlay && (
                <motion.div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                >
                    <WarningPanel title={overlay.type === 'fullscreen' ? 'Fullscreen required' : 'Tab switch detected'}>
                        {overlay.type === 'fullscreen' ? (
                            <>
                                <IconTile tone="danger" size={48} className="mx-auto mb-5"><Lock size={22} aria-hidden /></IconTile>
                                <h2 className="mb-2 text-lg font-semibold tracking-tight text-fg">
                                    Fullscreen required
                                </h2>
                                <p className="mb-2 text-sm leading-relaxed text-fg-2">
                                    You exited fullscreen mode. The {label} must be taken in fullscreen at all times.
                                </p>
                                <p className="mb-7 text-xs font-medium text-danger-text">
                                    This incident has been logged.
                                </p>
                                <Button
                                    variant="danger"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => {
                                        document.documentElement.requestFullscreen()
                                            .then(onDismiss)
                                            .catch(() => {});
                                    }}
                                >
                                    Return to fullscreen
                                </Button>
                            </>
                        ) : (
                            <>
                                <IconTile tone="warning" size={48} className="mx-auto mb-5"><AlertTriangle size={22} aria-hidden /></IconTile>
                                <h2 className="mb-2 text-lg font-semibold tracking-tight text-fg">
                                    Tab switch detected
                                </h2>
                                <p className="mb-2 text-sm leading-relaxed text-fg-2">
                                    You switched away from the {label} window.
                                </p>
                                {overlay.switchCount !== undefined && (
                                    <p className="mb-7 text-sm font-medium text-warning-text">
                                        {overlay.switchCount}/{maxStrikes} violations — blocked after {maxStrikes}.
                                    </p>
                                )}
                                <Button
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    onClick={() => {
                                        onDismiss();
                                        document.documentElement.requestFullscreen().catch(() => {});
                                    }}
                                >
                                    Return to {label === 'exam' ? 'exam' : label}
                                </Button>
                            </>
                        )}
                    </WarningPanel>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// The warning itself is an alert dialog: announced when it appears, focus moves to its button and stays in it.
// Esc does nothing here: the only way on is the button, which also restores fullscreen.
function WarningPanel({ title, children }: { title: string; children: React.ReactNode }) {
    const { props } = useDialogPanel<HTMLDivElement>(title, noop);
    return (
        <motion.div
            {...props}
            role="alertdialog"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-xl bg-raised p-8 text-center shadow-float focus:outline-none"
        >
            {children}
        </motion.div>
    );
}
