import React from 'react';
import { useDialogPanel } from './useDialog';

interface OverlayProps {
    /** Names the dialog for a screen reader */
    label: string;
    onClose: () => void;
    /** Classes for the dimmed backdrop (position, alignment) */
    className: string;
    /** Classes for the panel itself */
    panelClassName: string;
    children: React.ReactNode;
}

// A dimmed backdrop with one panel on it: a real dialog (focus moves in and is kept there, Esc closes, focus returns),
// closed by a click on the backdrop as well.
export default function Overlay({ label, onClose, className, panelClassName, children }: OverlayProps) {
    const { props } = useDialogPanel<HTMLDivElement>(label, onClose);
    return (
        <div className={className} onClick={onClose}>
            <div {...props} className={`${panelClassName} focus:outline-none`} onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}
