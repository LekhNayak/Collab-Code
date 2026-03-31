import React from 'react';
import { motion } from 'framer-motion';

// ─── GlassCard ─────────────────────────────────────────────────────────────
interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    hover?: boolean;
    glow?: 'indigo' | 'violet' | 'cyan' | 'red' | 'emerald' | 'none';
    padding?: 'sm' | 'md' | 'lg' | 'xl';
    as?: 'div' | 'motion';
}

const glowMap = {
    indigo: 'hover:shadow-[0_8px_32px_rgba(99,102,241,0.25)] hover:border-indigo-400/40',
    violet: 'hover:shadow-[0_8px_32px_rgba(139,92,246,0.25)] hover:border-violet-400/40',
    cyan:   'hover:shadow-[0_8px_32px_rgba(6,182,212,0.25)] hover:border-cyan-400/40',
    red:    'hover:shadow-[0_8px_32px_rgba(239,68,68,0.25)] hover:border-red-400/40',
    emerald:'hover:shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:border-emerald-400/40',
    none:   '',
};

const paddingMap = { sm: 'p-4', md: 'p-6', lg: 'p-8', xl: 'p-10' };

export function GlassCard({ children, hover = false, glow = 'none', padding = 'lg', className = '', onClick, ...rest }: GlassCardProps) {
    const base = `
        relative bg-white/[0.07] backdrop-blur-2xl
        border border-white/[0.12] rounded-3xl
        shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]
        transition-all duration-300
        ${paddingMap[padding]}
        ${hover ? `cursor-pointer ${glowMap[glow]} hover:bg-white/[0.10] hover:-translate-y-1` : ''}
        ${className}
    `;
    if (hover) {
        return (
            <motion.div
                className={base}
                onClick={onClick}
                whileTap={{ scale: 0.98 }}
                {...(rest as any)}
            >
                {/* inner top-edge highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl pointer-events-none" />
                {children}
            </motion.div>
        );
    }
    return (
        <div className={base} onClick={onClick} {...rest}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-3xl pointer-events-none" />
            {children}
        </div>
    );
}

// ─── GlassButton ───────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
type BtnSize = 'sm' | 'md' | 'lg';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: BtnVariant;
    size?: BtnSize;
    loading?: boolean;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

const variantStyles: Record<BtnVariant, string> = {
    primary:   'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 shadow-[0_4px_20px_rgba(99,102,241,0.35)] border-indigo-400/30 text-white',
    secondary: 'bg-white/[0.08] hover:bg-white/[0.14] border-white/[0.15] text-white/90',
    danger:    'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 shadow-[0_4px_20px_rgba(239,68,68,0.3)] border-red-400/30 text-white',
    success:   'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-[0_4px_20px_rgba(16,185,129,0.3)] border-emerald-400/30 text-white',
    ghost:     'bg-transparent hover:bg-white/[0.08] border-transparent text-white/70 hover:text-white',
};

const sizeStyles: Record<BtnSize, string> = {
    sm: 'px-4 py-2 text-sm rounded-xl gap-1.5',
    md: 'px-6 py-3 text-sm rounded-2xl gap-2',
    lg: 'px-8 py-4 text-base rounded-2xl gap-2.5',
};

export function GlassButton({ variant = 'secondary', size = 'md', loading = false, icon, children, className = '', disabled, ...rest }: GlassButtonProps) {
    return (
        <motion.button
            className={`
                inline-flex items-center justify-center font-semibold tracking-wide
                border backdrop-blur-xl transition-all duration-200
                ${variantStyles[variant]} ${sizeStyles[size]}
                disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
                ${className}
            `}
            whileTap={!disabled ? { scale: 0.97 } : {}}
            disabled={disabled || loading}
            {...(rest as any)}
        >
            {loading ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            ) : icon}
            {children}
        </motion.button>
    );
}

// ─── GlassInput ────────────────────────────────────────────────────────────
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
    accentColor?: string;
}

export function GlassInput({ label, error, icon, accentColor = 'indigo', className = '', ...rest }: GlassInputProps) {
    const focusRing = `focus:ring-2 focus:ring-${accentColor}-500/30 focus:border-${accentColor}-400/60`;
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && (
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-white/50 pl-1">
                    {label}
                </label>
            )}
            <div className="relative">
                {icon && (
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30">
                        {icon}
                    </div>
                )}
                <input
                    className={`
                        w-full bg-black/20 backdrop-blur-sm
                        border border-white/[0.12] rounded-2xl
                        text-white placeholder:text-white/25
                        ${icon ? 'pl-11' : 'pl-5'} pr-5 py-3.5
                        outline-none ${focusRing}
                        transition-all duration-200 text-sm
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]
                        ${error ? 'border-red-400/50 focus:border-red-400/70' : ''}
                        ${className}
                    `}
                    {...rest}
                />
            </div>
            {error && <p className="text-xs text-red-400 pl-1">{error}</p>}
        </div>
    );
}

// ─── GlassBadge ────────────────────────────────────────────────────────────
type BadgeColor = 'green' | 'red' | 'orange' | 'blue' | 'white';
interface GlassBadgeProps { color?: BadgeColor; children: React.ReactNode; dot?: boolean; }

const badgeColorMap: Record<BadgeColor, string> = {
    green:  'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
    red:    'bg-red-500/20 border-red-500/30 text-red-300',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-300',
    blue:   'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
    white:  'bg-white/10 border-white/20 text-white/80',
};

export function GlassBadge({ color = 'white', children, dot = false }: GlassBadgeProps) {
    const dotColorMap: Record<BadgeColor, string> = {
        green: 'bg-emerald-400', red: 'bg-red-400', orange: 'bg-orange-400', blue: 'bg-indigo-400', white: 'bg-white/60',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColorMap[color]}`}>
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColorMap[color]}`} />}
            {children}
        </span>
    );
}

// ─── GlassDivider ──────────────────────────────────────────────────────────
export function GlassDivider({ label }: { label?: string }) {
    return (
        <div className="relative flex items-center gap-4 py-2">
            <div className="flex-grow h-px bg-white/10" />
            {label && <span className="flex-shrink-0 text-[11px] uppercase tracking-[0.15em] font-semibold text-white/30">{label}</span>}
            <div className="flex-grow h-px bg-white/10" />
        </div>
    );
}
