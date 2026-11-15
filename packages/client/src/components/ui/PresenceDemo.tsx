import Badge from './Badge';

// The product in one frame: three people in the same file. Lekh types a new line, Chiranjan arrives and selects, Linus
// reads along at the function name, the run lands and holds, then what the loop added leaves together. Each person is one color everywhere (their cursor,
// their name tag, their dot). All motion is CSS (index.css, .pd-*); with reduced motion it rests on the result.
const LEKH = '#4ec9b0';
const CHIRANJAN = '#ff7a5c';
const LINUS = '#5aa9ff';

function Person({ name, color }: { name: string; color: string }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            {name}
        </span>
    );
}

export default function PresenceDemo({ className = '' }: { className?: string }) {
    return (
        <div
            className={`pd ui-card overflow-hidden ${className}`}
            style={{ boxShadow: 'var(--shadow-float)' }}
            role="img"
            aria-label="Three people editing the same Python file at once: Lekh types a new line, Chiranjan selects a range and Linus follows along, then the program runs and prints 55."
        >
            <div className="flex h-9 items-center justify-between border-b border-line bg-chrome px-3">
                <span className="font-mono text-xs text-fg">fib.py</span>
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <Person name="Lekh" color={LEKH} />
                    <Person name="Chiranjan" color={CHIRANJAN} />
                    <Person name="Linus" color={LINUS} />
                </div>
            </div>

            <div className="pd-code">
                <div className="pd-gutter" aria-hidden>{'1\n2\n3\n4\n5\n6'}</div>
                <div><span className="pd-kw">def</span> <span className="pd-fn">fib</span>(n):</div>
                <div>    a, b = <span className="pd-num">0</span>, <span className="pd-num">1</span></div>
                <div>    <span className="pd-kw">for</span> _ <span className="pd-kw">in</span> <span className="pd-fn">range</span>(n):</div>
                <div>        a, b = b, a + b</div>
                <div>    <span className="pd-kw">return</span> a</div>
                <div>
                    <span className="pd-typed"><span className="pd-fn">print</span>(<span className="pd-fn">fib</span>(<span className="pd-num">10</span>))</span>
                    <span className="pd-caret">
                        <span className="pd-tag" style={{ background: LEKH }}>Lekh</span>
                    </span>
                </div>

                <span className="pd-select" aria-hidden />
                <span className="pd-cursor pd-chiranjan" aria-hidden>
                    <span className="pd-tag" style={{ background: CHIRANJAN }}>Chiranjan</span>
                </span>
                <span className="pd-cursor pd-linus" aria-hidden>
                    <span className="pd-tag" style={{ background: LINUS }}>Linus</span>
                </span>
            </div>

            <div className="flex h-10 items-center gap-3 border-t border-line px-4">
                <div className="pd-out flex items-center gap-3">
                    <Badge tone="success" dot>Passed</Badge>
                    <span className="font-mono text-[13px] text-fg-2">fib(10) = <span className="font-semibold text-fg">55</span></span>
                </div>
            </div>
        </div>
    );
}
