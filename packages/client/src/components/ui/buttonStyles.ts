// Shared by Button and by the few places that style a native <button> the same way (dialog actions, dense toolbars).
export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type Size = 'sm' | 'md' | 'lg';


// A filled button keeps its own color under the pointer (one step lighter); it never swaps to gray.
const VARIANTS: Record<Variant, string> = {
    primary: 'bg-accent-solid text-white shadow-[var(--button-light),0_1px_2px_rgb(0_0_0_/_0.25)] hover:bg-accent',
    danger: 'bg-danger-solid text-white shadow-[var(--button-light),0_1px_2px_rgb(0_0_0_/_0.25)] hover:bg-danger',
    success: 'bg-success-solid text-white shadow-[var(--button-light),0_1px_2px_rgb(0_0_0_/_0.25)] hover:bg-success',
    secondary: 'bg-tint-2 text-fg shadow-[inset_0_0_0_1px_rgb(var(--ink)_/_0.10)] hover:bg-tint-3',
    ghost: 'text-fg-2 hover:bg-tint-2 hover:text-fg',
};

const SIZES: Record<Size, string> = {
    sm: 'h-8 px-3 text-[13px] gap-1.5',
    md: 'h-9 px-3.5 text-[13px] gap-2',
    lg: 'h-11 px-5 text-sm gap-2',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = '') {
    return `inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-[color,background-color,transform,box-shadow] duration-150 ease-arrive active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}
