import { motion, AnimatePresence } from 'framer-motion';
import type { ProctoringOverlayState } from '../hooks/useProctoring';

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
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                        className={`max-w-md w-full bg-white/5 backdrop-blur-2xl rounded-2xl p-8 text-center shadow-2xl ${
                            overlay.type === 'fullscreen'
                                ? 'border border-red-500/30'
                                : 'border border-orange-500/30'
                        }`}
                    >
                        {overlay.type === 'fullscreen' ? (
                            <>
                                <div className="text-5xl mb-5">🔒</div>
                                <h2 className="text-xl font-black text-red-400 mb-3 tracking-tight">
                                    Fullscreen Required
                                </h2>
                                <p className="text-white/60 text-sm leading-relaxed mb-2">
                                    You exited fullscreen mode. The {label} must be taken in fullscreen at all times.
                                </p>
                                <p className="text-red-400/80 text-xs font-bold mb-7">
                                    This incident has been logged.
                                </p>
                                <button
                                    onClick={() => {
                                        document.documentElement.requestFullscreen()
                                            .then(onDismiss)
                                            .catch(() => {});
                                    }}
                                    className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white font-semibold text-sm transition-all"
                                >
                                    Return to Fullscreen
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-5xl mb-5">⚠️</div>
                                <h2 className="text-xl font-black text-orange-400 mb-3 tracking-tight">
                                    Tab Switch Detected
                                </h2>
                                <p className="text-white/60 text-sm leading-relaxed mb-2">
                                    You switched away from the {label} window.
                                </p>
                                {overlay.switchCount !== undefined && (
                                    <p className="text-orange-400 text-sm font-bold mb-7">
                                        {overlay.switchCount}/{maxStrikes} violations — blocked after {maxStrikes}.
                                    </p>
                                )}
                                <button
                                    onClick={() => {
                                        onDismiss();
                                        document.documentElement.requestFullscreen().catch(() => {});
                                    }}
                                    className="w-full py-3 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-white font-semibold text-sm transition-all"
                                >
                                    Return to {label === 'exam' ? 'Exam' : label.charAt(0).toUpperCase() + label.slice(1)}
                                </button>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
