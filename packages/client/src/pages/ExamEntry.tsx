import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LiquidEther from '../components/ui/LiquidEther';

export default function ExamEntry() {
    const navigate = useNavigate();
    const [examId, setExamId] = useState('');
    const [studentName, setStudentName] = useState(localStorage.getItem('collab-username') || '');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!studentName.trim() || !examId.trim()) {
            setError('Please provide both your name and the Exam ID.');
            return;
        }
        const code = examId.trim().toUpperCase();
        if (!code.startsWith('EX-')) {
            setError('Invalid Exam Code. It should start with EX- (e.g. EX-a1b2c3d4).');
            return;
        }
        localStorage.setItem('collab-username', studentName.trim());
        navigate(`/e/${code}`);
    };

    return (
        <div className="h-[100dvh] w-full bg-black text-white font-sans relative overflow-hidden">
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            <div className="absolute top-6 left-6 z-20">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold shadow-sm group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Hub
                </button>
            </div>

            <div className="absolute inset-0 z-10 overflow-x-hidden overflow-y-auto flex flex-col items-center p-4 md:p-8">
            <div className="max-w-lg w-full relative my-auto pt-12 md:pt-0">
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-16 h-16 bg-[#0ea5e9]/90 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(14,165,233,0.4)] mx-auto mb-5"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                        <GraduationCap size={32} className="text-white" />
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
                        Take an Exam
                    </h1>
                    <p className="font-medium text-white/50 text-base">
                        Enter your credentials to access the secure exam environment
                    </p>
                </motion.div>

                <motion.div
                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl"
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={studentName}
                                onChange={(e) => { setStudentName(e.target.value); setError(''); }}
                                placeholder="e.g. John Doe"
                                required
                                className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#0ea5e9]/50 focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all text-base font-medium shadow-inner placeholder:text-white/30"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">
                                Exam ID
                            </label>
                            <input
                                type="text"
                                value={examId}
                                onChange={(e) => { setExamId(e.target.value); setError(''); }}
                                placeholder="Enter Exam ID (EX-...)"
                                required
                                className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#0ea5e9]/50 focus:ring-2 focus:ring-[#0ea5e9]/20 transition-all text-base font-medium font-mono uppercase shadow-inner placeholder:text-white/30 placeholder:normal-case"
                            />
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl p-4 font-semibold text-center text-sm shadow-lg"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            className="mt-2 w-full h-[56px] rounded-xl bg-gradient-to-r from-[#0ea5e9] to-[#0284c7] hover:from-[#0284c7] hover:to-[#0369a1] text-white font-bold text-base tracking-wide transition-all shadow-lg shadow-[#0ea5e9]/20 flex items-center justify-center gap-3"
                        >
                            <BookOpen size={20} /> Enter Exam
                        </button>
                    </form>
                </motion.div>
            </div>
            </div>
        </div>
    );
}
