import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, BookOpen, Code2, Download, Github, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cloneRepository, createSession } from '../api';
import ThemeToggle from '../components/ThemeToggle';
import LiquidEther from '../components/ui/LiquidEther';

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
    const [activeTab, setActiveTab] = useState<'selection' | 'student' | 'import'>('selection');

    // Student Form State
    const [examId, setExamId] = useState('');
    const [studentName, setStudentName] = useState(localStorage.getItem('collab-username') || '');
    const [error, setError] = useState('');

    // Import Project State
    const [repoUrl, setRepoUrl] = useState('');
    const [importing, setImporting] = useState(false);

    const generateRoomId = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `CR-${result}`;
    };

    const handleStudentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName.trim() || !examId.trim()) {
            setError('Please provide both your name and the Exam ID.');
            return;
        }

        const code = examId.trim();
        if (!code.startsWith('EX-')) {
            setError('Invalid Exam Code. It should start with EX- (e.g. EX-a1b2c3d4).');
            return;
        }

        localStorage.setItem('collab-username', studentName.trim());
        navigate(`/e/${code}`);
    };

    const handleImportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoUrl.trim()) {
            setError('Please provide a repository URL.');
            return;
        }
        setImporting(true);
        setError('');
        const username = localStorage.getItem('collab-username') || 'Anonymous';
        const roomId = generateRoomId();
        const name = `Project ${roomId}`;

        try {
            await cloneRepository(repoUrl.trim(), roomId);
            await createSession(name, roomId, roomId, username);
            navigate(`/room/${roomId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to import repository.');
            setImporting(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-4 md:p-8 font-sans relative overflow-x-hidden overflow-y-auto">
            {/* Liquid Ether Animated Background - Full darkness underneath perfectly compliments the transparent WebGL fluid */}
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
                <button 
                    className="px-6 py-2.5 rounded-full border border-red-500/30 text-red-500 font-bold bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-red-500/50 hover:text-red-400 transition-all shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    onClick={() => {
                        localStorage.removeItem('token');
                        navigate('/login');
                    }}
                >
                    Logout
                </button>
                <div className="bg-white/10 backdrop-blur-md rounded-full border border-white/20 p-2 text-white hover:bg-white/15 transition-all">
                    <ThemeToggle />
                </div>
            </div>

            <div className="max-w-7xl w-full relative z-10 px-4 mt-8 md:mt-2">
                <motion.div
                    className="text-center mb-16 flex flex-col items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-auto h-auto px-6 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full flex flex-row items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] mb-8 shadow-inner"
                        initial={{ scale: 0, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Code2 size={20} className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" /> 
                        <span className="font-semibold tracking-wider text-sm opacity-90">Collab Code</span>
                    </motion.div>
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
                        Choose your destination. Hop into a collaborative pair programming session, securely take an exam, or monitor a live test.
                    </motion.p>
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeTab === 'selection' ? (
                        <motion.div
                            key="selection"
                            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-[90rem] mx-auto"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                        >
                            {/* Collab Card */}
                            <motion.div variants={staggerItem} className="h-full">
                                <div 
                                    onClick={() => navigate('/collab')} 
                                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                                >
                                    <motion.div
                                        className="w-16 h-16 bg-[#8B5CF6]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300"
                                    >
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
                                    onClick={() => setActiveTab('student')} 
                                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                                >
                                    <motion.div
                                        className="w-16 h-16 bg-[#0ea5e9]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(14,165,233,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300"
                                    >
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
                                    <motion.div
                                        className="w-16 h-16 bg-[#ef4444]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300"
                                    >
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
                                    onClick={() => { setActiveTab('import'); setError(''); }} 
                                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 flex flex-col items-center text-center h-full cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300 group shadow-2xl"
                                >
                                    <motion.div
                                        className="w-16 h-16 bg-[#10b981]/90 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] mb-6 group-hover:scale-110 transition-transform duration-300"
                                    >
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
                        </motion.div>
                    ) : activeTab === 'student' ? (
                        <motion.div
                            key="student"
                            className="max-w-xl mx-auto"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-2xl">
                                <div className="flex items-center gap-4 mb-8 text-white">
                                    <button 
                                        onClick={() => { setActiveTab('selection'); setError(''); }} 
                                        className="p-3 bg-white/5 hover:bg-white/15 rounded-xl transition-all border border-white/10 group shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                                    >
                                        <ArrowRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={24} />
                                    </button>
                                    <h2 className="text-3xl font-bold tracking-tight">Join Secure Exam</h2>
                                </div>

                                <form onSubmit={handleStudentSubmit} className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-semibold text-white/70 uppercase tracking-widest pl-1">Full Name</label>
                                        <input
                                            type="text"
                                            value={studentName}
                                            onChange={(e) => {
                                                setStudentName(e.target.value);
                                                setError('');
                                            }}
                                            placeholder="e.g. John Doe"
                                            required
                                            className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#0ea5e9]/50 focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all text-lg shadow-inner placeholder:text-white/30"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-semibold text-white/70 uppercase tracking-widest pl-1">Exam ID</label>
                                        <input
                                            type="text"
                                            value={examId}
                                            onChange={(e) => {
                                                setExamId(e.target.value);
                                                setError('');
                                            }}
                                            placeholder="Enter Exam ID (EX-...)"
                                            required
                                            className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#0ea5e9]/50 focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all text-lg shadow-inner placeholder:text-white/30 font-mono uppercase"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl p-4 font-semibold text-center shadow-lg"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button 
                                        type="submit" 
                                        className="mt-4 w-full h-[60px] rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white font-bold text-lg tracking-wide transition-all shadow-lg flex items-center justify-center gap-3"
                                    >
                                        <BookOpen size={24} /> ENTER ENVIRONMENT
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="import"
                            className="max-w-xl mx-auto"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 shadow-2xl">
                                <div className="flex items-center gap-4 mb-8 text-white">
                                    <button 
                                        onClick={() => { setActiveTab('selection'); setError(''); }} 
                                        disabled={importing}
                                        className="p-3 bg-white/5 hover:bg-white/15 rounded-xl transition-all border border-white/10 group shadow-[0_4px_16px_rgba(0,0,0,0.3)] disabled:opacity-50"
                                    >
                                        <ArrowRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={24} />
                                    </button>
                                    <h2 className="text-3xl font-bold tracking-tight">Import Project</h2>
                                </div>

                                <form onSubmit={handleImportSubmit} className="flex flex-col gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-semibold text-white/70 uppercase tracking-widest pl-1">GitHub Repo URL</label>
                                        <input
                                            type="url"
                                            value={repoUrl}
                                            onChange={(e) => {
                                                setRepoUrl(e.target.value);
                                                setError('');
                                            }}
                                            placeholder="https://github.com/username/repo.git"
                                            required
                                            disabled={importing}
                                            className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#10b981]/50 focus:ring-2 focus:ring-[#10b981]/20 transition-all text-lg shadow-inner placeholder:text-white/30 disabled:opacity-50"
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl p-4 font-semibold text-center shadow-lg"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button 
                                        type="submit" 
                                        disabled={importing}
                                        className="mt-4 w-full h-[60px] rounded-xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-bold text-lg tracking-wide transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-70"
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 className="animate-spin" size={24} /> CLONING...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={24} /> CLONE REPOSITORY
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
