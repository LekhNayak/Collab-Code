// First stop for a keyboard user: jumps past the header controls to the page's own content (WCAG 2.4.1).
// Every route puts id="main-content" on its main region. Hidden until it takes focus.
export const MAIN_ID = 'main-content';

export default function SkipLink() {
    return (
        <a
            href={`#${MAIN_ID}`}
            onClick={(e) => {
                const target = document.getElementById(MAIN_ID);
                if (!target) return;
                e.preventDefault();
                target.focus();
                target.scrollIntoView({ block: 'start' });
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[10002] focus:rounded-lg focus:bg-accent-solid focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-float"
        >
            Skip to main content
        </a>
    );
}
