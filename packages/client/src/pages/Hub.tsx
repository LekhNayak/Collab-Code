import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, GraduationCap, Shield, ArrowRight, Github, Linkedin, Mail, Phone, Trophy,
    Plus, LogIn, Check, Clock, X, type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import GitHubOnboarding from '../components/GitHubOnboarding';
import Button from '../components/ui/Button';
import Wordmark from '../components/ui/Wordmark';
import PresenceDemo from '../components/ui/PresenceDemo';
import Pager from '../components/ui/Pager';
import ThemeToggle from '../components/ThemeToggle';
import { getRecent, removeRecent, timeAgo, type RecentItem } from '../recent';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const staggerItem = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

// Tells the destination page which form to focus (Room and Contests pages have both)
type Intent = 'create' | 'join';

interface PillarAction {
    label: string;
    icon: LucideIcon;
    to: string;
    intent?: Intent;
}

interface Pillar {
    eyebrow: string;
    title: string;
    pitch: string;
    bullets: string[];
    icon: LucideIcon;
    primary: PillarAction;
    secondary: PillarAction;
}

const PILLARS: Pillar[] = [
    {
        eyebrow: 'Collaborate',
        title: 'Code together, live',
        pitch: 'Share a room and edit the same files in real time, like a shared doc for code.',
        bullets: ['Live cursors and presence', 'Terminal, Git and code runner built in', 'Autosaved, survives reloads'],
        icon: Users,
        primary: { label: 'New room', icon: Plus, to: '/collab', intent: 'create' },
        secondary: { label: 'Join room', icon: LogIn, to: '/collab', intent: 'join' },
    },
    {
        eyebrow: 'Compete',
        title: 'Run coding contests',
        pitch: 'Problems with hidden test cases, automatic judging and a live leaderboard.',
        bullets: ['Partial credit per test case', 'Scheduled or instant start', 'Live organizer monitor'],
        icon: Trophy,
        primary: { label: 'Join contest', icon: LogIn, to: '/contests', intent: 'join' },
        secondary: { label: 'Host contest', icon: Plus, to: '/contests', intent: 'create' },
    },
    {
        eyebrow: 'Assess',
        title: 'Proctored exams',
        pitch: 'Isolated workspaces per student, anti-cheat rules and a live proctor view.',
        bullets: ['Fullscreen and tab-switch detection', 'Isolated code for every student', 'Live code monitoring'],
        icon: GraduationCap,
        primary: { label: 'Take exam', icon: LogIn, to: '/take-exam' },
        secondary: { label: 'Proctor area', icon: Shield, to: '/admin' },
    },
];

function PillarCard({ pillar, onAction }: { pillar: Pillar; onAction: (action: PillarAction) => void }) {
    const Icon = pillar.icon;
    const PrimaryIcon = pillar.primary.icon;
    const SecondaryIcon = pillar.secondary.icon;
    return (
        <motion.div variants={staggerItem} className="h-full">
            <div className="ui-card-interactive group flex h-full cursor-default flex-col p-6">
                <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-text transition-colors duration-200 group-hover:bg-accent-solid group-hover:text-white">
                        <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-medium text-fg-3">{pillar.eyebrow}</div>
                        <h2 className="text-lg font-semibold leading-tight text-fg">{pillar.title}</h2>
                    </div>
                </div>
                <p className="mb-5 leading-relaxed text-fg-2">{pillar.pitch}</p>
                <ul className="mb-6 flex-1 space-y-2.5">
                    {pillar.bullets.map(bullet => (
                        <li key={bullet} className="flex items-start gap-2.5 text-[13px] text-fg">
                            <Check size={15} className="mt-0.5 shrink-0 text-accent-text" />
                            {bullet}
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap gap-2 [&>button]:min-w-[7.5rem] [&>button]:flex-1">
                    <Button variant="primary" onClick={() => onAction(pillar.primary)}>
                        <PrimaryIcon size={15} /> {pillar.primary.label}
                    </Button>
                    <Button variant="secondary" onClick={() => onAction(pillar.secondary)}>
                        <SecondaryIcon size={15} /> {pillar.secondary.label}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}

const RECENT_PAGE = 5;

// "Jump back in": the last five rooms and contests opened in this browser, the rest on pages
function RecentStrip({ items, now, onOpen, onRemove }: {
    items: RecentItem[];
    now: number;
    onOpen: (item: RecentItem) => void;
    onRemove: (item: RecentItem) => void;
}) {
    const [page, setPage] = useState(0);
    if (items.length === 0) return null;
    const lastPage = Math.max(0, Math.ceil(items.length / RECENT_PAGE) - 1);
    const current = Math.min(page, lastPage);
    return (
        <motion.div
            className="mb-8 w-full"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
        >
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-fg-3">
                    <Clock size={13} /> Jump back in
                </div>
                <Pager page={current} pageSize={RECENT_PAGE} total={items.length} onChange={setPage} />
            </div>
            <div key={current} className="animate-arrive flex flex-wrap gap-2">
                {items.slice(current * RECENT_PAGE, (current + 1) * RECENT_PAGE).map(item => {
                    const isRoom = item.kind === 'room';
                    const Icon = isRoom ? Users : Trophy;
                    const label = item.title && item.title !== item.id ? item.title : isRoom ? 'Collab room' : 'Contest';
                    return (
                        <div key={`${item.kind}:${item.id}`} className="ui-card-interactive flex items-center">
                            <button
                                onClick={() => onOpen(item)}
                                className="flex items-center gap-3 rounded-xl py-2 pl-2.5 pr-2 text-left"
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tint-2 text-fg-2">
                                    <Icon size={15} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block max-w-[14rem] truncate text-[13px] font-medium text-fg">{label}</span>
                                    <span className="block text-xs text-fg-3">
                                        <span className="font-mono">{item.id}</span> · {timeAgo(item.at, now)}
                                    </span>
                                </span>
                            </button>
                            <button
                                onClick={() => onRemove(item)}
                                aria-label={`Remove ${label} from recent`}
                                title="Remove"
                                className="mr-1.5 inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-md text-fg-3 transition-colors hover:bg-tint-2 hover:text-fg"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

export default function Hub() {
    const navigate = useNavigate();
    const [showOnboarding, setShowOnboarding] = useState(
        () => localStorage.getItem('needsGitHubSetup') === 'true'
    );
    const [recent, setRecent] = useState(() => getRecent());
    const [now] = useState(() => Date.now());

    const dismissOnboarding = () => {
        localStorage.removeItem('needsGitHubSetup');
        setShowOnboarding(false);
    };

    const go = (action: PillarAction) => navigate(action.to, action.intent ? { state: { intent: action.intent } } : undefined);
    const openRecent = (item: RecentItem) => navigate(item.kind === 'room' ? `/room/${item.id}` : `/c/${item.id}`);

    return (
        <>
        <div className="relative flex h-[100dvh] w-full flex-col overflow-y-auto overflow-x-hidden bg-canvas font-sans text-fg">
            <div aria-hidden className="ground-dots pointer-events-none absolute inset-x-0 top-0 h-[460px]" />
            <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-canvas/90 backdrop-blur-md">
              <div className="mx-auto flex h-16 w-full max-w-[92rem] items-center justify-between px-5 sm:px-8">
                <Wordmark />
                <div className="flex items-center gap-1.5">
                <ThemeToggle />
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        localStorage.removeItem('token');
                        navigate('/login');
                    }}
                >
                    Log out
                </Button>
                </div>
              </div>
            </header>

            <main id="main-content" tabIndex={-1} className="relative mx-auto flex w-full max-w-[92rem] focus:outline-none flex-1 flex-col px-5 pb-16 pt-10 sm:px-8 md:pt-14">
                <div className="mb-14 grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-14">
                    <motion.div
                        className="flex flex-col items-center text-center lg:items-start lg:text-left"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.25, 0.8, 0.25, 1] }}
                    >
                        <h1 className="mb-5 text-[clamp(2rem,2.2rem+1.1vw,3.5rem)] font-semibold leading-[1.08] tracking-tight text-fg">
                            The coding environment, <span className="text-accent-text">made fluid</span> at your fingertips.
                        </h1>
                        <p className="max-w-xl text-[15px] leading-relaxed text-fg-2 xl:text-base">
                            Choose your destination. Hop into a collaborative pair programming session, securely take an exam, monitor a live test, or host a coding contest.
                        </p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.12, ease: [0.25, 0.8, 0.25, 1] }}
                        className="mx-auto w-full max-w-[680px] lg:mr-0"
                    >
                        <PresenceDemo />
                    </motion.div>
                </div>

                <RecentStrip items={recent} now={now} onOpen={openRecent} onRemove={item => setRecent(removeRecent(item.kind, item.id))} />

                <motion.div
                    className="w-full"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                >
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {PILLARS.map(pillar => (
                            <PillarCard key={pillar.eyebrow} pillar={pillar} onAction={go} />
                        ))}
                    </div>

                    <motion.button
                        variants={staggerItem}
                        onClick={() => navigate('/import')}
                        className="ui-card-interactive group mt-4 flex w-full items-center gap-4 px-5 py-4 text-left"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tint-2 text-fg">
                            <Github size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[15px] font-semibold text-fg">Import a GitHub repository</div>
                            <div className="text-[13px] text-fg-2">Clone any public repo into a new collaborative workspace and start coding together.</div>
                        </div>
                        <span className="hidden shrink-0 items-center gap-1.5 text-[13px] font-medium text-accent-text sm:flex">
                            Import <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                        </span>
                    </motion.button>
                </motion.div>
            </main>

            <footer className="relative mt-auto shrink-0 border-t border-line px-5 py-8 sm:px-8">
                <div className="mx-auto flex max-w-[92rem] flex-col items-center justify-between gap-6 md:flex-row">
                    <div className="flex flex-col items-center gap-0.5 md:items-start">
                        <h3 className="text-sm font-semibold text-fg">Lekh Sanatan Nayak</h3>
                        <p className="text-[13px] text-fg-3">Creator & lead developer</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                        <a href="mailto:lekh.nayak23@spit.ac.in" className="flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-fg">
                            <Mail size={15} /> lekh.nayak23@spit.ac.in
                        </a>
                        <a href="tel:9326456576" className="flex items-center gap-2 text-[13px] text-fg-2 transition-colors hover:text-fg">
                            <Phone size={15} /> 9326456576
                        </a>
                        <div className="hidden h-5 w-px bg-line md:block" />
                        <a href="https://github.com/LekhNayak" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-tint-2 hover:text-fg">
                            <Github size={18} />
                        </a>
                        <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-tint-2 hover:text-fg">
                            <Linkedin size={18} />
                        </a>
                    </div>
                </div>
            </footer>
        </div>

        {showOnboarding && <GitHubOnboarding onComplete={dismissOnboarding} />}
        </>
    );
}
