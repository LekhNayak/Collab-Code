import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, GraduationCap, Shield, ArrowRight, Code2, Github, Linkedin, Mail, Phone, Trophy,
    Plus, LogIn, Check, Clock, X, type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import LiquidEther from '../components/ui/LiquidEther';
import GitHubOnboarding from '../components/GitHubOnboarding';
import { getRecent, removeRecent, timeAgo, type RecentItem } from '../recent';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.12, delayChildren: 0.2 }
    }
};

const staggerItem = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] as const } }
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
    // Full class names per accent: Tailwind can't see class names assembled at runtime
    styles: { tile: string; eyebrow: string; hairline: string; check: string; card: string; primary: string };
}

const PILLARS: Pillar[] = [
    {
        eyebrow: 'COLLABORATE',
        title: 'Code together, live',
        pitch: 'Share a room and edit the same files in real time, like a shared doc for code.',
        bullets: ['Live cursors and presence', 'Terminal, Git and code runner built in', 'Autosaved, survives reloads'],
        icon: Users,
        primary: { label: 'New room', icon: Plus, to: '/collab', intent: 'create' },
        secondary: { label: 'Join room', icon: LogIn, to: '/collab', intent: 'join' },
        styles: {
            tile: 'bg-[#8B5CF6]/90 shadow-[0_0_30px_rgba(139,92,246,0.45)]',
            eyebrow: 'text-violet-300',
            hairline: 'via-violet-400/70',
            check: 'text-violet-300',
            card: 'hover:border-violet-400/40 hover:shadow-[0_24px_60px_-20px_rgba(139,92,246,0.5)]',
            primary: 'bg-violet-500 hover:bg-violet-400 text-white focus-visible:ring-violet-300/70',
        },
    },
    {
        eyebrow: 'COMPETE',
        title: 'Run coding contests',
        pitch: 'Problems with hidden test cases, automatic judging and a live leaderboard.',
        bullets: ['Partial credit per test case', 'Scheduled or instant start', 'Live organizer monitor'],
        icon: Trophy,
        primary: { label: 'Join contest', icon: LogIn, to: '/contests', intent: 'join' },
        secondary: { label: 'Host contest', icon: Plus, to: '/contests', intent: 'create' },
        styles: {
            tile: 'bg-[#f59e0b]/90 shadow-[0_0_30px_rgba(245,158,11,0.45)]',
            eyebrow: 'text-amber-300',
            hairline: 'via-amber-400/70',
            check: 'text-amber-300',
            card: 'hover:border-amber-400/40 hover:shadow-[0_24px_60px_-20px_rgba(245,158,11,0.45)]',
            primary: 'bg-amber-500 hover:bg-amber-400 text-black focus-visible:ring-amber-300/70',
        },
    },
    {
        eyebrow: 'ASSESS',
        title: 'Proctored exams',
        pitch: 'Isolated workspaces per student, anti-cheat rules and a live proctor view.',
        bullets: ['Fullscreen and tab-switch detection', 'Isolated code for every student', 'Live code monitoring'],
        icon: GraduationCap,
        primary: { label: 'Take exam', icon: LogIn, to: '/take-exam' },
        secondary: { label: 'Proctor area', icon: Shield, to: '/admin' },
        styles: {
            tile: 'bg-[#0ea5e9]/90 shadow-[0_0_30px_rgba(14,165,233,0.45)]',
            eyebrow: 'text-sky-300',
            hairline: 'via-sky-400/70',
            check: 'text-sky-300',
            card: 'hover:border-sky-400/40 hover:shadow-[0_24px_60px_-20px_rgba(14,165,233,0.45)]',
            primary: 'bg-sky-500 hover:bg-sky-400 text-white focus-visible:ring-sky-300/70',
        },
    },
];

const actionButtonClass = 'flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2';

function PillarCard({ pillar, onAction }: { pillar: Pillar; onAction: (action: PillarAction) => void }) {
    const Icon = pillar.icon;
    const PrimaryIcon = pillar.primary.icon;
    const SecondaryIcon = pillar.secondary.icon;
    return (
        <motion.div variants={staggerItem} className="h-full">
            <div className={`group relative h-full flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-2xl p-8 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-black/40 ${pillar.styles.card}`}>
                <div className={`absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent to-transparent ${pillar.styles.hairline}`} />
                <div className="flex items-center gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${pillar.styles.tile}`}>
                        <Icon size={28} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <div className={`text-xs font-bold tracking-[0.2em] mb-1 ${pillar.styles.eyebrow}`}>{pillar.eyebrow}</div>
                        <h2 className="text-2xl font-bold text-white leading-tight">{pillar.title}</h2>
                    </div>
                </div>
                <p className="text-white/70 leading-relaxed mb-6">{pillar.pitch}</p>
                <ul className="space-y-2.5 mb-8 flex-1">
                    {pillar.bullets.map(bullet => (
                        <li key={bullet} className="flex items-start gap-2.5 text-sm text-white/80">
                            <Check size={16} strokeWidth={3} className={`mt-0.5 shrink-0 ${pillar.styles.check}`} />
                            {bullet}
                        </li>
                    ))}
                </ul>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => onAction(pillar.primary)} className={`${actionButtonClass} ${pillar.styles.primary}`}>
                        <PrimaryIcon size={17} strokeWidth={2.5} /> {pillar.primary.label}
                    </button>
                    <button onClick={() => onAction(pillar.secondary)} className={`${actionButtonClass} bg-white/5 hover:bg-white/10 border border-white/15 text-white focus-visible:ring-white/40`}>
                        <SecondaryIcon size={17} strokeWidth={2.5} /> {pillar.secondary.label}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// "Jump back in": recently opened rooms and contests (this browser only)
function RecentStrip({ items, now, onOpen, onRemove }: {
    items: RecentItem[];
    now: number;
    onOpen: (item: RecentItem) => void;
    onRemove: (item: RecentItem) => void;
}) {
    if (items.length === 0) return null;
    return (
        <motion.div
            className="w-full max-w-6xl mx-auto mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
        >
            <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-white/50 mb-3">
                <Clock size={14} /> JUMP BACK IN
            </div>
            <div className="flex flex-wrap gap-3">
                {items.slice(0, 6).map(item => {
                    const isRoom = item.kind === 'room';
                    const Icon = isRoom ? Users : Trophy;
                    const label = item.title && item.title !== item.id ? item.title : isRoom ? 'Collab room' : 'Contest';
                    return (
                        <div key={`${item.kind}:${item.id}`} className="flex items-center rounded-xl border border-white/10 bg-black/30 backdrop-blur-xl hover:border-white/25 transition-colors">
                            <button
                                onClick={() => onOpen(item)}
                                className="flex items-center gap-3 pl-3 pr-2 py-2.5 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isRoom ? 'bg-violet-500/20 text-violet-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    <Icon size={16} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-white truncate max-w-[14rem]">{label}</span>
                                    <span className="block text-xs text-white/45">
                                        <span className="font-mono">{item.id}</span> · {timeAgo(item.at, now)}
                                    </span>
                                </span>
                            </button>
                            <button
                                onClick={() => onRemove(item)}
                                aria-label={`Remove ${label} from recent`}
                                title="Remove"
                                className="p-2 mr-1 rounded-lg text-white/30 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                            >
                                <X size={14} />
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
        <div className="h-[100dvh] w-full bg-black text-white font-sans relative overflow-hidden">
            {/* Liquid Ether Animated Background Fixed in place */}
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            {/* Fixed Top Header */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-30">
                <motion.div
                    className="w-auto h-auto px-6 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex flex-row items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] shadow-inner"
                    initial={{ scale: 0, y: -20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <Code2 size={20} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" /> 
                    <span className="font-semibold tracking-wider text-sm opacity-90">Collab Code</span>
                </motion.div>

                <button 
                    className="px-6 py-2.5 rounded-full border border-red-500/30 text-red-500 font-bold bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-red-500/50 hover:text-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    onClick={() => {
                        localStorage.removeItem('token');
                        navigate('/login');
                    }}
                >
                    Logout
                </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="absolute inset-0 z-10 overflow-x-hidden overflow-y-auto flex flex-col items-center">
                <div className="max-w-7xl w-full flex-1 flex flex-col px-4 pt-24 md:pt-32 pb-16">
                <motion.div
                    className="text-center mb-16 flex flex-col items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.h1
                        className="text-5xl md:text-7xl xl:text-8xl font-black mb-7 tracking-tight text-white drop-shadow-lg leading-[1.1]"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        The coding environment,<br/> made fluid at your fingertips.
                    </motion.h1>
                    <motion.p
                        className="font-medium text-lg md:text-xl max-w-3xl mx-auto tracking-wide text-indigo-100/70 leading-relaxed bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-2xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                    >
                        Choose your destination. Hop into a collaborative pair programming session, securely take an exam, monitor a live test, or host a coding contest.
                    </motion.p>
                </motion.div>

                <RecentStrip items={recent} now={now} onOpen={openRecent} onRemove={item => setRecent(removeRecent(item.kind, item.id))} />

                <motion.div
                    className="w-full max-w-6xl mx-auto"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {PILLARS.map(pillar => (
                            <PillarCard key={pillar.eyebrow} pillar={pillar} onAction={go} />
                        ))}
                    </div>

                    <motion.button
                        variants={staggerItem}
                        onClick={() => navigate('/import')}
                        className="group mt-6 w-full flex items-center gap-5 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-2xl px-6 py-5 text-left shadow-2xl transition-all duration-300 hover:bg-black/40 hover:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                    >
                        <div className="w-12 h-12 rounded-xl bg-[#10b981]/90 shadow-[0_0_24px_rgba(16,185,129,0.4)] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                            <Github size={24} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-lg text-white">Import a GitHub repository</div>
                            <div className="text-sm text-white/60">Clone any public repo into a new collaborative workspace and start coding together.</div>
                        </div>
                        <span className="hidden sm:flex items-center gap-2 text-sm font-semibold text-emerald-300 shrink-0">
                            Import <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </motion.button>
                </motion.div>
                </div>

                {/* Footer */}
                <footer className="w-full bg-white/5 backdrop-blur-2xl border-t border-white/10 mt-auto relative z-20 py-8 px-6">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex flex-col items-center md:items-start gap-1">
                            <h3 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300 tracking-wide">
                                Lekh Sanatan Nayak
                            </h3>
                            <p className="text-white/40 text-sm font-medium">Creator & Lead Developer</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-6">
                            <a href="mailto:lekh.nayak23@spit.ac.in" className="flex items-center gap-2 text-white/60 hover:text-indigo-300 transition-colors font-medium">
                                <Mail size={18} /> lekh.nayak23@spit.ac.in
                            </a>
                            <a href="tel:9326456576" className="flex items-center gap-2 text-white/60 hover:text-indigo-300 transition-colors font-medium">
                                <Phone size={18} /> 9326456576
                            </a>
                            <div className="h-6 w-px bg-white/10 hidden md:block"></div>
                            <a href="https://github.com/LekhNayak" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/20 shadow-lg">
                                <Github size={20} />
                            </a>
                            <a href="https://linkedin.com/" target="_blank" rel="noopener noreferrer" className="p-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-full text-indigo-400 hover:text-indigo-300 transition-all border border-indigo-500/20 hover:border-indigo-500/40 shadow-lg">
                                <Linkedin size={20} />
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>

        {showOnboarding && <GitHubOnboarding onComplete={dismissOnboarding} />}
        </>
    );
}
