import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { MAIN_ID } from './ui/SkipLink';

// What each screen is called in the tab strip and to a screen reader (WCAG 2.4.2)
const TITLES: [pattern: string, title: string][] = [
    ['/login', 'Sign in'],
    ['/', 'Home'],
    ['/collab', 'Collab rooms'],
    ['/take-exam', 'Take an exam'],
    ['/import', 'Import a project'],
    ['/room/:roomId', 'Room'],
    ['/admin', 'Exams'],
    ['/exam/:examId/monitor', 'Live exam monitor'],
    ['/e/:roomId', 'Exam'],
    ['/collab-admin/:roomId', 'Room sessions'],
    ['/contests', 'Contests'],
    ['/contests/:id/manage', 'Manage contest'],
    ['/contests/:id/monitor', 'Contest monitor'],
    ['/c/:code', 'Contest'],
];
const APP = 'Colab Code Editor';

// A single-page app never reloads, so nothing tells assistive tech that a new screen arrived. On each navigation this
// sets the document title and, unless something already has focus, moves focus to the new page's main region so the
// reader starts at its content instead of wherever the old screen left them (WCAG 2.4.3).
export default function RouteA11y() {
    const { pathname } = useLocation();
    const first = useRef(true);

    useEffect(() => {
        const hit = TITLES.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
        document.title = hit ? `${hit[1]} · ${APP}` : APP;

        // Not on first load: the browser already starts at the top of the page
        if (first.current) {
            first.current = false;
            return;
        }

        // Lazy routes render a moment later, so wait (briefly) for the region to exist
        let frame = 0;
        let tries = 0;
        const focusMain = () => {
            const active = document.activeElement;
            if (active && active !== document.body) return;
            const main = document.getElementById(MAIN_ID);
            if (main) {
                main.focus({ preventScroll: true });
            } else if (++tries < 40) {
                frame = requestAnimationFrame(focusMain);
            }
        };
        frame = requestAnimationFrame(focusMain);
        return () => cancelAnimationFrame(frame);
    }, [pathname]);

    return null;
}
