import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from './Button';

interface PageShellProps {
    title: string;
    subtitle?: React.ReactNode;
    /** Where the back button goes; omit for a page with no parent */
    backTo?: string | -1;
    backLabel?: string;
    /** Right side of the top bar */
    actions?: React.ReactNode;
    /** Content width: sm 448, md 672, lg 896, xl 1152 */
    width?: 'sm' | 'md' | 'lg' | 'xl';
    /** Center the heading (a form page) instead of left-aligning it (a list page) */
    centered?: boolean;
    children: React.ReactNode;
}

const WIDTH = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

// The frame every secondary page shares: a quiet top bar with the way back, then a heading and the content.
export default function PageShell({ title, subtitle, backTo, backLabel = 'Back', actions, width = 'md', centered = false, children }: PageShellProps) {
    const navigate = useNavigate();
    return (
        <div className="flex h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden bg-canvas font-sans text-fg">
            <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur-md sm:px-6">
                {backTo ? (
                    <Button variant="ghost" size="sm" onClick={() => (typeof backTo === 'number' ? navigate(backTo) : navigate(backTo))} icon={<ArrowLeft size={15} />}>
                        {backLabel}
                    </Button>
                ) : <span />}
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </header>
            <main className={`mx-auto w-full flex-1 px-4 pb-16 pt-10 sm:px-6 ${WIDTH[width]}`}>
                <div className={`mb-8 ${centered ? 'text-center' : ''}`}>
                    <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
                    {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-fg-2">{subtitle}</p>}
                </div>
                {children}
            </main>
        </div>
    );
}
