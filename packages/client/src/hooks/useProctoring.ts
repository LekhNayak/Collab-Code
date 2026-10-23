import { useEffect, useEffectEvent, useState } from 'react';

// Anti-cheat rules shared by exams and contests: fullscreen enforcement, tab-switch detection,
// keyboard shortcut blocking and copy/paste limits. Where events are reported (and what counts as
// "blocked") is up to the adapter.

export interface ProctoringAdapter {
    // The page was hidden. Return the violation count so far (or null if nothing was recorded).
    tabSwitch: () => Promise<{ blocked: boolean; count?: number; reason?: string | null } | null>;
    fullscreenExit: () => Promise<unknown>;
    // Copied or pasted more than 20 characters
    clipboard: (kind: 'copy' | 'paste', length: number, sample: string) => Promise<unknown>;
    // Checked once when proctoring starts
    status: () => Promise<{ blocked: boolean; reason?: string | null }>;
}

export type ProctoringOverlayState = { type: 'fullscreen' | 'tab-switch'; switchCount?: number } | null;

const COPY_LOG_CHARS = 20;
const COPY_BLOCK_CHARS = 50;

interface Options {
    enabled: boolean;
    sessionKey: string | null; // restarts the listeners when it changes (e.g. the exam id)
    adapter: ProctoringAdapter;
    onBlocked: (reason: string | null | undefined) => void;
}

export function useProctoring({ enabled, sessionKey, adapter, onBlocked }: Options) {
    const [overlay, setOverlay] = useState<ProctoringOverlayState>(null);
    const report = useEffectEvent((call: (adapter: ProctoringAdapter) => Promise<unknown>) => call(adapter));
    const block = useEffectEvent((reason: string | null | undefined) => onBlocked(reason));

    useEffect(() => {
        if (!enabled || !sessionKey) return;

        const enterFullscreen = () => {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
        };

        // ── Tab-switch detection ──
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                try {
                    const result = await report(a => a.tabSwitch()) as Awaited<ReturnType<ProctoringAdapter['tabSwitch']>>;
                    if (result?.blocked) {
                        block(result.reason);
                    } else if (result) {
                        setOverlay({ type: 'tab-switch', switchCount: result.count });
                    }
                } catch (e) {
                    console.error('Error logging tab switch', e);
                }
            } else if (document.visibilityState === 'visible') {
                // Re-enter fullscreen whenever they come back
                enterFullscreen();
            }
        };

        // ── Fullscreen enforcement ──
        const handleFullscreenChange = async () => {
            if (!document.fullscreenElement) {
                setOverlay({ type: 'fullscreen' });
                try {
                    await report(a => a.fullscreenExit());
                } catch (e) {
                    console.error('Error logging fullscreen exit', e);
                }
            } else {
                // Back in fullscreen — dismiss any overlay
                setOverlay(null);
            }
        };

        // ── Window blur: catches Alt+Tab to another OS window (not just browser tabs) ──
        const handleWindowBlur = () => {
            // Only show the overlay — visibilitychange handles logging.
            // Use a small delay so we don't flicker on benign focus transfers (e.g. dev tools).
            setTimeout(() => {
                if (!document.hasFocus()) {
                    setOverlay(prev => prev ?? { type: 'tab-switch', switchCount: undefined });
                }
            }, 300);
        };

        // ── Keyboard shortcut blocking ──
        const handleKeyDown = (e: KeyboardEvent) => {
            const shouldBlock =
                // Tab switching
                (e.ctrlKey && e.key === 'Tab') ||
                (e.ctrlKey && e.shiftKey && e.key === 'Tab') ||
                // Close / new tab / new window
                (e.ctrlKey && (e.key === 'w' || e.key === 'W')) ||
                (e.ctrlKey && (e.key === 't' || e.key === 'T')) ||
                (e.ctrlKey && (e.key === 'n' || e.key === 'N')) ||
                // DevTools
                (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) ||
                e.key === 'F12' ||
                // Fullscreen toggle
                e.key === 'F11' ||
                // Close window (Windows/Linux)
                (e.altKey && e.key === 'F4');

            if (shouldBlock) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        // ── Copy enforcement: log if > 20 chars, block if > 50 ──
        const handleCopy = async (e: ClipboardEvent) => {
            const selected = window.getSelection()?.toString() || '';
            const length = selected.length;
            // Block before awaiting anything: preventDefault has no effect once the handler yields
            if (length > COPY_BLOCK_CHARS) {
                e.preventDefault();
                e.clipboardData?.setData('text/plain', '');
            }
            if (length > COPY_LOG_CHARS) {
                try {
                    await report(a => a.clipboard('copy', length, selected.substring(0, 200)));
                } catch (err) {
                    console.error('Failed to log copy event', err);
                }
            }
        };

        // ── Paste enforcement: block if > 50 chars, log if > 20 chars ──
        const handlePaste = async (e: ClipboardEvent) => {
            const pastedText = e.clipboardData?.getData('text/plain') || '';
            const length = pastedText.length;
            if (length > COPY_BLOCK_CHARS) e.preventDefault();
            if (length > COPY_LOG_CHARS) {
                try {
                    await report(a => a.clipboard('paste', length, pastedText.substring(0, 200)));
                } catch (err) {
                    console.error('Failed to log paste', err);
                }
            }
        };

        // Check if currently blocked on mount
        report(a => a.status())
            .then(status => {
                const s = status as Awaited<ReturnType<ProctoringAdapter['status']>>;
                if (s?.blocked) block(s.reason);
            })
            .catch(console.error);

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        // capture: true so we intercept before Monaco/other handlers
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('copy', handleCopy as unknown as EventListener);
        document.addEventListener('paste', handlePaste as unknown as EventListener);
        window.addEventListener('blur', handleWindowBlur);

        // First click triggers fullscreen (browser policy)
        document.body.addEventListener('click', enterFullscreen, { once: true });
        enterFullscreen();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('copy', handleCopy as unknown as EventListener);
            document.removeEventListener('paste', handlePaste as unknown as EventListener);
            window.removeEventListener('blur', handleWindowBlur);
            document.body.removeEventListener('click', enterFullscreen);
        };
    }, [enabled, sessionKey]);

    return { overlay, dismissOverlay: () => setOverlay(null) };
}
