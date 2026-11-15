// The product's name as plain type: no invented logo.
export default function Wordmark({ className = '' }: { className?: string }) {
    return <span className={`text-sm font-semibold tracking-tight text-fg ${className}`}>Colab Code</span>;
}
