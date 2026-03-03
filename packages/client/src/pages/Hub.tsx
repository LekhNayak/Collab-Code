import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, BookOpen, Code2, Download, Github, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cloneRepository, createSession } from '../api';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
        // Navigate using the room code directly as the roomId param
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
        <div className="min-h-[100dvh] bg-neo-bg text-neo-text flex flex-col items-center justify-center p-4 md:p-8 font-sans relative overflow-x-hidden overflow-y-auto">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute w-40 h-40 border-4 border-neo-border opacity-[0.04]"
                    style={{ top: '5%', right: '10%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                    className="absolute w-20 h-20 bg-neo-accent opacity-[0.06]"
                    style={{ bottom: '20%', left: '5%' }}
                    animate={{ y: [-15, 15, -15] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute w-12 h-12 border-4 border-neo-accent opacity-[0.05]"
                    style={{ top: '50%', right: '5%', borderRadius: '50%' }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
                <BrutalButton variant="danger" size="sm" onClick={() => {
                    localStorage.removeItem('token');
                    navigate('/login');
                }}>
                    LOGOUT
                </BrutalButton>
                <ThemeToggle />
            </div>

            <div className="max-w-7xl w-full relative z-10 px-4">
                <motion.div
                    className="text-center mb-8 flex flex-col items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-6"
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Code2 size={36} className="text-neo-accent-text" />
                    </motion.div>
                    <motion.h1
                        className="text-5xl md:text-7xl font-black mb-4 uppercase tracking-tighter text-neo-text drop-shadow-sm leading-none"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                    >
                        Colab Cloud
                    </motion.h1>
                    <motion.p
                        className="font-bold text-lg md:text-xl uppercase max-w-3xl mx-auto tracking-wide text-neo-text-secondary leading-relaxed bg-neo-surface border-4 border-neo-border p-3 shadow-brutal-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4 }}
                    >
                        Choose your destination. Hop into a pair programming session, take an exam, or monitor a live test.
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
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => navigate('/collab')} className="flex flex-col items-center text-center h-full" delay={0}>
                                    <motion.div
                                        className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6 mx-auto"
                                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1, transition: { duration: 0.4 } }}
                                    >
                                        <Users size={32} className="text-neo-accent-text" />
                                    </motion.div>
                                    <h2 className="text-2xl md:text-3xl font-black mb-3 uppercase text-neo-text">Collaboration</h2>
                                    <p className="font-semibold mb-6 flex-1 text-base md:text-lg text-neo-text-secondary">
                                        Create or join real-time coding rooms. Pair program, share files, and execute code together.
                                    </p>
                                    <BrutalButton className="w-full text-lg py-3 mt-auto">
                                        OPEN HUB <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>

                            {/* Student Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => setActiveTab('student')} className="flex flex-col items-center text-center h-full" delay={1}>
                                    <motion.div
                                        className="w-16 h-16 bg-neo-surface border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6 mx-auto"
                                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1, transition: { duration: 0.4 } }}
                                    >
                                        <GraduationCap size={32} className="text-neo-text" />
                                    </motion.div>
                                    <h2 className="text-2xl md:text-3xl font-black mb-3 uppercase text-neo-text">Take an Exam</h2>
                                    <p className="font-semibold mb-6 flex-1 text-base md:text-lg text-neo-text-secondary">
                                        Log in as a student to join a secure, monitored examination room. Requires a valid Exam ID.
                                    </p>
                                    <BrutalButton className="w-full text-lg py-3 mt-auto">
                                        GIVE EXAM <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>

                            {/* Admin Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => navigate('/admin')} className="flex flex-col items-center text-center h-full" delay={2}>
                                    <motion.div
                                        className="w-16 h-16 bg-neo-error border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6 mx-auto"
                                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1, transition: { duration: 0.4 } }}
                                    >
                                        <Shield size={32} className="text-white" />
                                    </motion.div>
                                    <h2 className="text-2xl md:text-3xl font-black mb-3 uppercase text-neo-error">Proctor Area</h2>
                                    <p className="font-semibold mb-6 flex-1 text-base md:text-lg text-neo-text-secondary">
                                        For teachers and admins. Deploy exams, monitor students in real-time.
                                    </p>
                                    <BrutalButton variant="danger" className="w-full text-lg py-3 mt-auto">
                                        DASHBOARD <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>

                            {/* Import Project Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => { setActiveTab('import'); setError(''); }} className="flex flex-col items-center text-center h-full" delay={3}>
                                    <motion.div
                                        className="w-16 h-16 bg-neo-success border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6 mx-auto"
                                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1, transition: { duration: 0.4 } }}
                                    >
                                        <Github size={32} className="text-neo-bg" />
                                    </motion.div>
                                    <h2 className="text-2xl md:text-3xl font-black mb-3 uppercase text-neo-success">Import Project</h2>
                                    <p className="font-semibold mb-6 flex-1 text-base md:text-lg text-neo-text-secondary">
                                        Clone directly from GitHub and jump straight into a collaborative IDE workspace.
                                    </p>
                                    <BrutalButton variant="primary" className="w-full text-lg py-3 mt-auto !bg-neo-success !text-neo-bg hover:!bg-[#2e7d32]">
                                        IMPORT <Download size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>
                        </motion.div>
                    ) : activeTab === 'student' ? (
                        <motion.div
                            key="student"
                            className="max-w-lg mx-auto"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <BrutalCard>
                                <div className="flex items-center gap-4 mb-8">
                                    <BrutalButton size="sm" onClick={() => { setActiveTab('selection'); setError(''); }} className="px-3 py-2">
                                        <ArrowRight className="rotate-180" size={24} />
                                    </BrutalButton>
                                    <h2 className="text-3xl font-black uppercase text-neo-text">Join Secure Exam</h2>
                                </div>

                                <form onSubmit={handleStudentSubmit} className="flex flex-col gap-6">
                                    <BrutalInput
                                        label="Full Name"
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => {
                                            setStudentName(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="e.g. John Doe"
                                        required
                                    />
                                    <BrutalInput
                                        label="Exam ID"
                                        type="text"
                                        value={examId}
                                        onChange={(e) => {
                                            setExamId(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="Enter Exam ID provided by instructor..."
                                        required
                                    />

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm overflow-hidden"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <BrutalButton type="submit" variant="primary" size="lg" className="mt-4 text-xl tracking-wide uppercase">
                                        <BookOpen size={24} /> Enter Environment
                                    </BrutalButton>
                                </form>
                            </BrutalCard>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="import"
                            className="max-w-lg mx-auto"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <BrutalCard>
                                <div className="flex items-center gap-4 mb-8">
                                    <BrutalButton size="sm" onClick={() => { setActiveTab('selection'); setError(''); }} className="px-3 py-2" disabled={importing}>
                                        <ArrowRight className="rotate-180" size={24} />
                                    </BrutalButton>
                                    <h2 className="text-3xl font-black uppercase text-neo-text">Import Project</h2>
                                </div>

                                <form onSubmit={handleImportSubmit} className="flex flex-col gap-6">
                                    <BrutalInput
                                        label="GitHub Repository URL"
                                        type="url"
                                        value={repoUrl}
                                        onChange={(e) => {
                                            setRepoUrl(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="https://github.com/username/repo.git"
                                        required
                                        disabled={importing}
                                    />

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm overflow-hidden"
                                            >
                                                {error}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <BrutalButton type="submit" variant="primary" size="lg" className="mt-4 text-xl tracking-wide uppercase flex justify-center items-center gap-2" disabled={importing}>
                                        {importing ? (
                                            <>
                                                <Loader2 className="animate-spin" size={24} /> CLONING...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={24} /> Clone Repository
                                            </>
                                        )}
                                    </BrutalButton>
                                </form>
                            </BrutalCard>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
