import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, BookOpen, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] } }
};

export default function Hub() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'selection' | 'student'>('selection');

    // Student Form State
    const [examId, setExamId] = useState('');
    const [studentName, setStudentName] = useState(localStorage.getItem('collab-username') || '');
    const [error, setError] = useState('');

    const handleStudentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName.trim() || !examId.trim()) {
            setError('Please provide both your name and the Exam ID.');
            return;
        }
        localStorage.setItem('collab-username', studentName.trim());
        navigate(`/e/${examId.trim()}`);
    };

    return (
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
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

            <div className="max-w-6xl w-full relative z-10">
                <motion.div
                    className="text-center mb-16 flex flex-col items-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-24 h-24 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-8"
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Code2 size={48} className="text-neo-accent-text" />
                    </motion.div>
                    <motion.h1
                        className="text-5xl md:text-6xl font-black mb-4 uppercase tracking-tighter text-neo-text"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                    >
                        Welcome to Colab Cloud
                    </motion.h1>
                    <motion.p
                        className="font-bold text-xl uppercase max-w-2xl mx-auto tracking-wide text-neo-text-secondary"
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
                            className="grid grid-cols-1 md:grid-cols-3 gap-8"
                            variants={staggerContainer}
                            initial="hidden"
                            animate="show"
                            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                        >
                            {/* Collab Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => navigate('/collab')} className="flex flex-col items-center text-center h-full" delay={0}>
                                    <motion.div
                                        className="w-20 h-20 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6"
                                        whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.4 } }}
                                    >
                                        <Users size={40} className="text-neo-accent-text" />
                                    </motion.div>
                                    <h2 className="text-3xl font-black mb-4 uppercase text-neo-text">Collaboration</h2>
                                    <p className="font-semibold mb-8 flex-1 text-lg text-neo-text-secondary">
                                        Create or join real-time coding rooms. Pair program, share files, and execute code together.
                                    </p>
                                    <BrutalButton className="w-full text-xl mt-auto">
                                        OPEN HUB <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>

                            {/* Student Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => setActiveTab('student')} className="flex flex-col items-center text-center h-full" delay={1}>
                                    <motion.div
                                        className="w-20 h-20 bg-neo-surface border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6"
                                        whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.4 } }}
                                    >
                                        <GraduationCap size={40} className="text-neo-text" />
                                    </motion.div>
                                    <h2 className="text-3xl font-black mb-4 uppercase text-neo-text">Take an Exam</h2>
                                    <p className="font-semibold mb-8 flex-1 text-lg text-neo-text-secondary">
                                        Log in as a student to join a secure, monitored examination room. Requires a valid Exam ID.
                                    </p>
                                    <BrutalButton className="w-full text-xl mt-auto">
                                        ENTER PORTAL <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>

                            {/* Admin Card */}
                            <motion.div variants={staggerItem}>
                                <BrutalCard hoverable onClick={() => navigate('/admin')} className="flex flex-col items-center text-center h-full" delay={2}>
                                    <motion.div
                                        className="w-20 h-20 bg-neo-error border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6"
                                        whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.4 } }}
                                    >
                                        <Shield size={40} className="text-white" />
                                    </motion.div>
                                    <h2 className="text-3xl font-black mb-4 uppercase text-neo-error">Proctor Area</h2>
                                    <p className="font-semibold mb-8 flex-1 text-lg text-neo-text-secondary">
                                        For teachers and admins. Deploy exams, monitor students in real-time, and view comprehensive logs.
                                    </p>
                                    <BrutalButton variant="danger" className="w-full text-xl mt-auto">
                                        DASHBOARD <ArrowRight size={20} />
                                    </BrutalButton>
                                </BrutalCard>
                            </motion.div>
                        </motion.div>
                    ) : (
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
                                    <BrutalButton size="sm" onClick={() => setActiveTab('selection')} className="px-3 py-2">
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
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
