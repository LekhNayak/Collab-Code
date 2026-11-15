import React from 'react';
import { Loader2 } from 'lucide-react';
import { buttonClass, type Variant, type Size } from './buttonStyles';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: React.ReactNode;
}

export default function Button({ variant = 'secondary', size = 'md', loading = false, icon, className = '', disabled, children, ...rest }: ButtonProps) {
    return (
        <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
            {children}
        </button>
    );
}
