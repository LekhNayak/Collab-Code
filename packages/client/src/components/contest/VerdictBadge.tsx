import { VERDICT_LABEL, VERDICT_STYLE, type Verdict } from '../../contestApi';

export default function VerdictBadge({ verdict, short = false, className = '' }: { verdict: Verdict; short?: boolean; className?: string }) {
    return (
        <span
            className={`inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium ${VERDICT_STYLE[verdict]} ${className}`}
            title={VERDICT_LABEL[verdict]}
        >
            {short ? verdict : VERDICT_LABEL[verdict]}
        </span>
    );
}
