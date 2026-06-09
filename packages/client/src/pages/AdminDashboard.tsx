import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ChevronRight, LogOut, Code2, Trash2, Copy, ArrowLeft } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { getExams, createExam, deleteExam } from '../api';
import type { ExamRoom } from '../api';
import LiquidEther from '../components/ui/LiquidEther';
import Modal from '../components/ui/Modal';

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
};

const staggerItem: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export default function AdminDashboard() {
    const [exams, setExams] = useState<ExamRoom[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [examToDelete, setExamToDelete] = useState<string | null>(null);
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            const data = await getExams();
            setExams(data);
        } catch (err: any) {
            console.error('Failed to load exams', err);
            if (err.message && err.message.includes('Foreign key constraint')) {
                setAlertMessage('Your session is invalid or belongs to an old guest account. Please log out and log back in.');
                setAlertModalOpen(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('collab-username');
        navigate('/login');
    };

    const handleCreate = async () => {
        if (!newTitle) return;
        try {
            const exam = await createExam(newTitle, new Date().toISOString());
            setExams([exam, ...exams]);
            setNewTitle('');
        } catch (err: any) {
            console.error('Failed to create exam', err);
            setAlertMessage('Failed to create exam. It looks like your user session is invalid. Please log out and log in again.');
            setAlertModalOpen(true);
        }
    };

    const handleDeleteClick = (examId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExamToDelete(examId);
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!examToDelete) return;
        try {
            await deleteExam(examToDelete);
            setExams(exams.filter(exam => exam.id !== examToDelete));
            setDeleteModalOpen(false);
            setExamToDelete(null);
        } catch (err: any) {
            console.error('Failed to delete exam', err);
            setAlertMessage('Failed to delete exam room.');
            setAlertModalOpen(true);
        }
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

            <div className="absolute inset-0 z-10 overflow-x-hidden overflow-y-auto flex flex-col p-6 md:p-12 pt-20 md:pt-24">
            {/* No Top Nav elements required here presently */}

                <div className="max-w-6xl mx-auto w-full relative z-10">
                <motion.div
                    className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 border-b border-white/10 pb-6 mt-4 backdrop-blur-sm"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="flex items-center gap-5">
                        <motion.div
                            className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-white/20"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
                        >
                            <Users size={32} className="text-white" />
                        </motion.div>
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                                Proctor Dashboard
                            </h1>
                            <p className="font-medium text-lg text-indigo-200/70">Exam Management Area</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="mt-6 md:mt-0 px-5 py-2.5 rounded-xl bg-white/5 border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/10 hover:border-red-500/50 transition-all flex items-center gap-2"
                    >
                        <LogOut size={18} /> LOGOUT
                    </button>
                </motion.div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-12 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                    <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
                        <Plus className="text-indigo-400" /> Create New Exam
                    </h2>
                    <div className="flex flex-col md:flex-row gap-5 items-end">
                        <div className="flex-1 w-full flex flex-col gap-2">
                            <label className="text-sm font-semibold text-white/70 uppercase tracking-widest pl-1">Exam Title</label>
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g., Midterm Algorithms"
                                className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all text-lg shadow-inner"
                            />
                        </div>
                        <button
                            onClick={handleCreate}
                            className="w-full md:w-auto h-[58px] px-8 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
                        >
                            <Plus size={20} /> CREATE ROOM
                        </button>
                    </div>
                </div>

                <motion.h2
                    className="text-3xl font-bold mb-8 flex items-center gap-3 text-white"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    <div className="w-2 h-8 bg-indigo-500 rounded-full" /> Active Exam Rooms
                </motion.h2>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                className="h-56 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md"
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                ) : exams.length === 0 ? (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-16 text-center shadow-lg">
                        <div className="flex flex-col items-center gap-6">
                            <motion.div
                                className="w-20 h-20 bg-black/20 rounded-full border border-white/10 flex items-center justify-center shadow-inner"
                                animate={{ y: [-5, 5, -5] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Code2 size={40} className="text-indigo-400" />
                            </motion.div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-2">No Exams Created Yet</h3>
                                <p className="text-white/50 text-lg">Create your first exam room above to get started.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {exams.map((exam) => (
                            <motion.div key={exam.id} variants={staggerItem}>
                                <div
                                    className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl cursor-pointer hover:bg-white/15 hover:border-white/30 transition-all hover:-translate-y-1 group flex flex-col h-full"
                                    onClick={() => navigate(`/exam/${exam.id}/monitor`)}
                                >
                                    <div className="flex justify-between items-start mb-8">
                                        <h3 className="text-2xl font-bold text-white leading-tight group-hover:text-indigo-300 transition-colors line-clamp-2 pr-4">
                                            {exam.title}
                                        </h3>
                                        <button
                                            type="button"
                                            className="bg-black/20 p-2 rounded-lg border border-white/10 text-white/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                                            onClick={(e) => handleDeleteClick(exam.id, e)}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                    <div className="space-y-4 text-sm font-medium mt-auto">
                                        <div className="flex items-center gap-3 text-white/70">
                                            <div className="p-1.5 bg-black/20 rounded-md border border-white/10 text-indigo-300">
                                                <Clock size={16} />
                                            </div>
                                            {new Date(exam.startTime).toLocaleDateString()} at {new Date(exam.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        {exam.roomCode && (
                                            <div className="flex items-center justify-between bg-black/30 rounded-lg border border-white/5 p-2">
                                                <span className="font-mono text-indigo-300 tracking-wider font-bold">
                                                    {exam.roomCode}
                                                </span>
                                                <button
                                                    className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                                                    title="Copy exam code"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(exam.roomCode!);
                                                    }}
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        )}
                                        <div className="pt-4 border-t border-white/10 flex items-center text-indigo-400 font-semibold group-hover:gap-2 transition-all">
                                            Monitor Exam <ChevronRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
            </div>

            <Modal
                isOpen={deleteModalOpen}
                title="Delete Exam?"
                icon="🗑️"
                actions={[
                    {
                        label: 'Cancel',
                        variant: 'ghost',
                        onClick: () => { setDeleteModalOpen(false); setExamToDelete(null); },
                    },
                    {
                        label: 'Delete Exam',
                        variant: 'danger',
                        onClick: confirmDelete,
                    },
                ]}
                onClose={() => { setDeleteModalOpen(false); setExamToDelete(null); }}
            >
                Are you sure you want to delete this exam room? This action cannot be undone and will remove all associated student logs and sessions.
            </Modal>

            <Modal
                isOpen={alertModalOpen}
                title="Notice"
                icon="⚠️"
                actions={[
                    {
                        label: 'Dismiss',
                        variant: 'primary',
                        onClick: () => setAlertModalOpen(false),
                    },
                ]}
                onClose={() => setAlertModalOpen(false)}
            >
                {alertMessage}
            </Modal>
        </div>
    );
}
