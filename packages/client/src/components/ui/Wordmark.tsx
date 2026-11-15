// The product's name as plain type, with two editor carets in it: one after "Colab", one at the end. Two people typing,
// each in their own color (the same two colors as the hero's Lekh and Chiranjan). No invented logo.
function Caret({ color, delay }: { color: string; delay: string }) {
    return (
        <span
            aria-hidden
            className="caret-blink mx-[1.5px] inline-block h-[1.1em] w-[2px] rounded-[1px]"
            style={{ background: color, animationDelay: delay }}
        />
    );
}

export default function Wordmark({ className = '' }: { className?: string }) {
    return (
        <span className={`inline-flex items-center whitespace-pre text-[17px] font-semibold tracking-tight text-fg ${className}`}>
            Colab<Caret color="#4ec9b0" delay="0s" /> Code<Caret color="#ff7a5c" delay="-0.55s" />
        </span>
    );
}
