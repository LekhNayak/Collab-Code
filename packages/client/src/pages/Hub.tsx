import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, Code2, Download, Github, Linkedin, Mail, Phone, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import LiquidEther from '../components/ui/LiquidEther';
import GitHubOnboarding from '../components/GitHubOnboarding';

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

export default function Hub() {
    const navigate = useNavigate();
    const [showOnboarding, setShowOnboarding] = useState(
        () => localStorage.getItem('needsGitHubSetup') === 'true'
    );

    const dismissOnboarding = () => {
        localStorage.removeItem('needsGitHubSetup');
        setShowOnboarding(false);
    };

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

                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-6 max-w-[110rem] mx-auto"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                >
                    {/* Collab Card */}
                    <motion.div variants={staggerItem} className="h-full">
                        <div
                            onClick={() => navigate('/collab')}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                        >
                            <motion.div className="w-16 h-16 bg-[#8B5CF6]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Users size={32} className="text-white" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-4 text-white">Collaboration</h2>
                            <p className="font-medium mb-8 flex-1 text-sm text-white/50 leading-relaxed">
                                Create or join real-time coding rooms. Pair program, share files, and execute code together seamlessly.
                            </p>
                            <button className="w-full text-[15px] py-3.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all flex items-center justify-center gap-2 border border-white/10 shadow-sm">
                                Open Hub <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Student Card */}
                    <motion.div variants={staggerItem} className="h-full">
                        <div
                            onClick={() => navigate('/take-exam')}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                        >
                            <motion.div className="w-16 h-16 bg-[#0ea5e9]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                <GraduationCap size={32} className="text-white" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-4 text-white">Take an Exam</h2>
                            <p className="font-medium mb-8 flex-1 text-sm text-white/50 leading-relaxed">
                                Log in as a student to join a secure, actively monitored examination room. Requires an Exam ID.
                            </p>
                            <button className="w-full text-[15px] py-3.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-all flex items-center justify-center gap-2 border border-white/10 shadow-sm">
                                Give Exam <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Admin Card */}
                    <motion.div variants={staggerItem} className="h-full">
                        <div
                            onClick={() => navigate('/admin')}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                        >
                            <motion.div className="w-16 h-16 bg-[#ef4444]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Shield size={32} className="text-white" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-4 text-white">Proctor Area</h2>
                            <p className="font-medium mb-8 flex-1 text-sm text-white/50 leading-relaxed">
                                For teachers and admins. Deploy exams, configure parameters, and monitor students in real-time.
                            </p>
                            <button className="w-full text-[15px] py-3.5 px-6 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[#fca5a5] font-semibold transition-all flex items-center justify-center gap-2 border border-red-500/20 shadow-sm">
                                Dashboard <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Import Project Card */}
                    <motion.div variants={staggerItem} className="h-full">
                        <div
                            onClick={() => navigate('/import')}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                        >
                            <motion.div className="w-16 h-16 bg-[#10b981]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Github size={32} className="text-white" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-4 text-white">Import Project</h2>
                            <p className="font-medium mb-8 flex-1 text-sm text-white/50 leading-relaxed">
                                Clone directly from any public GitHub repository and jump straight into a collaborative IDE workspace.
                            </p>
                            <button className="w-full text-[15px] py-3.5 px-6 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[#6ee7b7] font-semibold transition-all flex items-center justify-center gap-2 border border-emerald-500/20 shadow-sm">
                                Import <Download size={18} strokeWidth={2.5} className="group-hover:-translate-y-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Contests Card */}
                    <motion.div variants={staggerItem} className="h-full">
                        <div
                            onClick={() => navigate('/contests')}
                            className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                        >
                            <motion.div className="w-16 h-16 bg-[#f59e0b]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300">
                                <Trophy size={32} className="text-white" />
                            </motion.div>
                            <h2 className="text-2xl font-bold mb-4 text-white">Contests</h2>
                            <p className="font-medium mb-8 flex-1 text-sm text-white/50 leading-relaxed">
                                Host or join competitive coding contests. Problems with hidden test cases, automatic judging, and a live leaderboard.
                            </p>
                            <button className="w-full text-[15px] py-3.5 px-6 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#fcd34d] font-semibold transition-all flex items-center justify-center gap-2 border border-amber-500/20 shadow-sm">
                                Compete <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </motion.div>
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
