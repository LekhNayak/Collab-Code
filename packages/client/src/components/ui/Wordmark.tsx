// The product's name as plain type, ending in an editor caret: no invented logo.
export default function Wordmark({ className = '' }: { className?: string }) {
    return (
        <span className={`inline-flex items-center text-sm font-semibold tracking-tight text-fg ${className}`}>
            Colab Code
            <span aria-hidden className="caret-blink ml-[3px] inline-block h-[1.05em] w-[2px] rounded-[1px] bg-accent" />
        </span>
    );
}
