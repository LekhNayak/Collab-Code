import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ChevronRight, LogOut, Code2, Trash2, Copy } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { getExams, createExam, deleteExam } from '../api';
import type { ExamRoom } from '../api';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
        <div className="flex h-screen bg-neo-bg text-neo-text p-8 overflow-y-auto font-sans relative">
            <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
                <ThemeToggle />
            </div>

            <div className="max-w-6xl mx-auto w-full">
                <motion.div
                    className="flex justify-between items-center mb-12 border-b-4 border-neo-border pb-6 mt-4"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="flex items-center gap-4">
                        <motion.div
                            className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal-sm"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            <Users size={32} className="text-neo-accent-text" />
                        </motion.div>
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter text-neo-text">
                                Proctor Dashboard
                            </h1>
                            <p className="font-bold text-lg uppercase text-neo-text-secondary">Exam Management</p>
                        </div>
                    </div>
                    <BrutalButton variant="danger" size="sm" onClick={handleLogout} className="flex gap-2">
                        <LogOut size={18} /> LOGOUT
                    </BrutalButton>
                </motion.div>

                <BrutalCard className="mb-12">
                    <h2 className="text-2xl font-black uppercase mb-4 text-neo-text">Create New Exam</h2>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <BrutalInput
                                type="text"
                                label="Exam Title"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="e.g., Midterm Algorithms"
                            />
                        </div>
                        <BrutalButton
                            variant="primary"
                            size="lg"
                            onClick={handleCreate}
                            className="w-full md:w-auto h-[48px] flex items-center justify-center gap-2 mb-1"
                        >
                            <Plus size={20} /> CREATE ROOM
                        </BrutalButton>
                    </div>
                </BrutalCard>

                <motion.h2
                    className="text-3xl font-black mb-8 uppercase border-b-4 border-neo-border pb-2 inline-block text-neo-text"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                >
                    Active Exam Rooms
                </motion.h2>

                {loading ? (
                    <div className="flex gap-4">
                        {[1, 2, 3].map(i => (
                            <motion.div
                                key={i}
                                className="flex-1 h-48 bg-neo-surface border-4 border-neo-border"
                                animate={{ opacity: [0.4, 0.7, 0.4] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                            />
                        ))}
                    </div>
                ) : exams.length === 0 ? (
                    <BrutalCard className="text-center py-12">
                        <div className="flex flex-col items-center gap-4">
                            <motion.div
                                className="w-16 h-16 bg-neo-surface border-4 border-neo-border flex items-center justify-center shadow-brutal-sm"
                                animate={{ y: [-3, 3, -3] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Code2 size={32} className="text-neo-text-secondary" />
                            </motion.div>
                            <h3 className="text-2xl font-black uppercase text-neo-text">No Exams Created Yet</h3>
                            <p className="font-bold text-neo-text-secondary">Create an exam room to get started.</p>
                        </div>
                    </BrutalCard>
                ) : (
                    <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {exams.map((exam, index) => (
                            <motion.div key={exam.id} variants={staggerItem}>
                                <BrutalCard
                                    hoverable
                                    className="cursor-pointer flex flex-col h-full"
                                    onClick={() => navigate(`/exam/${exam.id}/monitor`)}
                                    delay={index}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <h3 className="text-2xl font-black uppercase line-clamp-2 text-neo-text">{exam.title}</h3>
                                        <div className="flex gap-2">
                                            <motion.button
                                                type="button"
                                                className="bg-neo-surface p-2 border-2 border-neo-border shadow-brutal-sm hover:bg-red-500 group"
                                                onClick={(e) => handleDeleteClick(exam.id, e)}
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Trash2 size={20} className="text-neo-text-secondary group-hover:text-white" />
                                            </motion.button>
                                            <motion.div
                                                className="bg-neo-accent p-2 border-2 border-neo-border shadow-brutal-sm relative z-10"
                                                whileHover={{ x: 3, transition: { duration: 0.2 } }}
                                            >
                                                <ChevronRight size={20} className="text-neo-accent-text" />
                                            </motion.div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 font-bold text-sm mt-auto">
                                        <p className="flex items-center gap-2 text-neo-text-secondary">
                                            <div className="p-1 bg-neo-surface border-2 border-neo-border">
                                                <Clock size={16} />
                                            </div>
                                            {new Date(exam.startTime).toLocaleDateString()} {new Date(exam.startTime).toLocaleTimeString()}
                                        </p>
                                        {exam.roomCode && (
                                            <div className="flex items-center gap-2">
                                                <span className="bg-neo-border text-neo-bg px-2 py-1 border-2 border-neo-border shadow-brutal-sm uppercase text-xs font-black tracking-wider">
                                                    {exam.roomCode}
                                                </span>
                                                <button
                                                    className="bg-neo-surface p-1 border-2 border-neo-border hover:bg-neo-accent transition-colors"
                                                    title="Copy exam code for students"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(exam.roomCode!);
                                                    }}
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </BrutalCard>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Custom Delete Confirmation Modal */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-neo-bg max-w-md w-full border-4 border-neo-border shadow-[8px_8px_0px_0px_var(--neo-shadow)]"
                    >
                        <div className="bg-neo-surface p-6">
                            <h3 className="text-2xl font-black uppercase text-neo-text mb-4">Confirm Deletion</h3>
                            <p className="text-neo-text-secondary font-bold mb-8">
                                Are you sure you want to delete this exam room? This action cannot be undone and will delete all associated logs.
                            </p>
                            <div className="flex justify-end gap-4">
                                <BrutalButton
                                    variant="secondary"
                                    onClick={() => {
                                        setDeleteModalOpen(false);
                                        setExamToDelete(null);
                                    }}
                                >
                                    CANCEL
                                </BrutalButton>
                                <BrutalButton variant="danger" onClick={confirmDelete}>
                                    DELETE
                                </BrutalButton>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Custom Alert Modal */}
            {alertModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-neo-bg max-w-md w-full border-4 border-neo-border shadow-[8px_8px_0px_0px_var(--neo-shadow)]"
                    >
                        <div className="bg-neo-surface p-6">
                            <h3 className="text-2xl font-black uppercase text-neo-text mb-4 text-red-500">Notice</h3>
                            <p className="text-neo-text-secondary font-bold mb-8">
                                {alertMessage}
                            </p>
                            <div className="flex justify-end gap-4">
                                <BrutalButton variant="primary" onClick={() => setAlertModalOpen(false)}>
                                    DISMISS
                                </BrutalButton>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
