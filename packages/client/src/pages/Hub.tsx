import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, BookOpen, User, Key, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

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

    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
    };

    return (
        <div className="min-h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#007acc] rounded-full blur-[120px] opacity-10" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#4ec9b0] rounded-full blur-[120px] opacity-10" />
            </div>

            <div className="max-w-5xl w-full relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="text-center mb-16"
                >
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#252526] border border-[#3c3c3c] mb-6 shadow-xl"
                    >
                        <Code2 size={40} className="text-[#007acc]" />
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-semibold mb-4 text-white">
                        Welcome to Colab Cloud
                    </h1>
                    <p className="text-[#969696] text-lg max-w-xl mx-auto">
                        Choose your destination. Hop into a pair programming session, take an exam, or monitor a live test.
                    </p>
                </motion.div>

                <AnimatePresence mode="wait">
                    {activeTab === 'selection' ? (
                        <motion.div
                            key="selection"
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-6"
                        >
                            {/* Collab Card */}
                            <motion.div
                                variants={itemVariants}
                                whileHover={{ scale: 1.02, backgroundColor: '#2d2d2d' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/collab')}
                                className="bg-[#252526] cursor-pointer border border-[#3c3c3c] hover:border-[#007acc]/50 rounded-xl p-8 flex flex-col items-center text-center group shadow-lg"
                            >
                                <div className="w-16 h-16 rounded-full bg-[#007acc]/10 flex items-center justify-center text-[#007acc] mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Users size={32} />
                                </div>
                                <h2 className="text-2xl font-semibold mb-3 text-white">Collaboration</h2>
                                <p className="text-[#969696] mb-8 flex-1 text-sm leading-relaxed">
                                    Create or join real-time coding rooms. Pair program, share files, and execute code together.
                                </p>
                                <span className="flex items-center gap-2 text-[#007acc] font-medium group-hover:text-[#1a8ad4] transition-colors">
                                    Open Hub <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </motion.div>

                            {/* Student Card */}
                            <motion.div
                                variants={itemVariants}
                                whileHover={{ scale: 1.02, backgroundColor: '#2d2d2d' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setActiveTab('student')}
                                className="bg-[#252526] cursor-pointer border border-[#3c3c3c] hover:border-[#4ec9b0]/50 rounded-xl p-8 flex flex-col items-center text-center group shadow-lg"
                            >
                                <div className="w-16 h-16 rounded-full bg-[#4ec9b0]/10 flex items-center justify-center text-[#4ec9b0] mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <GraduationCap size={32} />
                                </div>
                                <h2 className="text-2xl font-semibold mb-3 text-white">Take an Exam</h2>
                                <p className="text-[#969696] mb-8 flex-1 text-sm leading-relaxed">
                                    Log in as a student to join a secure, monitored examination room. Requires a valid Exam ID.
                                </p>
                                <span className="flex items-center gap-2 text-[#4ec9b0] font-medium group-hover:text-[#5ce7cb] transition-colors">
                                    Enter Portal <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </motion.div>

                            {/* Admin Card */}
                            <motion.div
                                variants={itemVariants}
                                whileHover={{ scale: 1.02, backgroundColor: '#2d2d2d' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate('/admin')}
                                className="bg-[#252526] cursor-pointer border border-[#3c3c3c] hover:border-[#f44747]/50 rounded-xl p-8 flex flex-col items-center text-center group shadow-lg"
                            >
                                <div className="w-16 h-16 rounded-full bg-[#f44747]/10 flex items-center justify-center text-[#f44747] mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Shield size={32} />
                                </div>
                                <h2 className="text-2xl font-semibold mb-3 text-white">Proctor Area</h2>
                                <p className="text-[#969696] mb-8 flex-1 text-sm leading-relaxed">
                                    For teachers and admins. Deploy exams, monitor students in real-time, and view comprehensive logs.
                                </p>
                                <span className="flex items-center gap-2 text-[#f44747] font-medium group-hover:text-[#ff6666] transition-colors">
                                    Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </motion.div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="student-form"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="max-w-md mx-auto bg-[#252526] border border-[#3c3c3c] rounded-xl p-8 shadow-2xl"
                        >
                            <div className="flex items-center gap-3 mb-8">
                                <motion.button
                                    whileHover={{ scale: 1.1, backgroundColor: '#333333' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setActiveTab('selection')}
                                    className="p-2 text-[#969696] hover:text-white rounded-lg transition-colors"
                                >
                                    <ArrowRight className="rotate-180" size={20} />
                                </motion.button>
                                <h2 className="text-2xl font-semibold text-white">Join Secure Exam</h2>
                            </div>

                            <form onSubmit={handleStudentSubmit} className="flex flex-col gap-5">
                                <div>
                                    <label className="flex items-center gap-2 text-xs text-[#969696] mb-1.5 font-medium ml-1">
                                        <User size={14} /> Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={studentName}
                                        onChange={(e) => {
                                            setStudentName(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="e.g. John Doe"
                                        className="w-full bg-[#3c3c3c] border border-transparent rounded p-2.5 text-white placeholder-[#6a6a6a] focus:bg-[#3c3c3c] focus:border-[#4ec9b0] focus:outline-none transition-colors text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs text-[#969696] mb-1.5 font-medium ml-1">
                                        <Key size={14} /> Exam ID
                                    </label>
                                    <input
                                        type="text"
                                        value={examId}
                                        onChange={(e) => {
                                            setExamId(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="Enter Exam ID provided by instructor..."
                                        className="w-full bg-[#3c3c3c] border border-transparent rounded p-2.5 text-white placeholder-[#6a6a6a] focus:bg-[#3c3c3c] focus:border-[#4ec9b0] focus:outline-none transition-colors text-sm"
                                    />
                                </div>

                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="bg-[#f44747]/10 border border-[#f44747]/50 text-[#f44747] p-3 rounded text-sm text-center">
                                                {error}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    type="submit"
                                    className="mt-4 w-full bg-[#007acc] hover:bg-[#1a8ad4] text-white font-medium py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2"
                                >
                                    <BookOpen size={18} /> Enter Environment
                                </motion.button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
