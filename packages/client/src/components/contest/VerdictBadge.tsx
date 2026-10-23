import { VERDICT_LABEL, VERDICT_STYLE, type Verdict } from '../../contestApi';

export default function VerdictBadge({ verdict, short = false, className = '' }: { verdict: Verdict; short?: boolean; className?: string }) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-bold tracking-wide ${VERDICT_STYLE[verdict]} ${className}`}
            title={VERDICT_LABEL[verdict]}
        >
            {short ? verdict : VERDICT_LABEL[verdict]}
        </span>
    );
}
