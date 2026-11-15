import React, { useId } from 'react';

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: React.ReactNode;
    error?: string;
    icon?: React.ReactNode;
}

// The ring is an inset shadow, so focusing never moves the text.
export default function Field({ label, hint, error, icon, className = '', id, ...rest }: FieldProps) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
        <div className="flex w-full flex-col gap-1.5">
            {label && <label htmlFor={inputId} className="ui-label">{label}</label>}
            <div className="relative">
                {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">{icon}</span>}
                <input
                    id={inputId}
                    aria-invalid={error ? true : undefined}
                    className={`ui-field ${icon ? 'pl-9' : ''} ${error ? '!shadow-[inset_0_0_0_1px_rgb(var(--danger)),0_0_0_3px_rgb(var(--danger)_/_0.2)]' : ''} ${className}`}
                    {...rest}
                />
            </div>
            {error ? <p className="text-xs text-danger-text">{error}</p> : hint ? <p className="text-xs text-fg-3">{hint}</p> : null}
        </div>
    );
}
