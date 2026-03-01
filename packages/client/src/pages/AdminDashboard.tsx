import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ChevronRight, LogOut, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { getExams, createExam } from '../api';
import type { ExamRoom } from '../api';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 }
    }
};

const staggerItem = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] } }
};

export default function AdminDashboard() {
    const [exams, setExams] = useState<ExamRoom[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
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
                alert('Your session is invalid or belongs to an old guest account. Please log out and log back in.');
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
            alert(`Failed to create exam. It looks like your user session is invalid. Please log out and log in again.`);
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
                                        <motion.div
                                            className="bg-neo-accent p-2 border-2 border-neo-border shadow-brutal-sm"
                                            whileHover={{ x: 3, transition: { duration: 0.2 } }}
                                        >
                                            <ChevronRight size={20} className="text-neo-accent-text" />
                                        </motion.div>
                                    </div>
                                    <div className="space-y-4 font-bold text-sm mt-auto">
                                        <p className="flex items-center gap-2 text-neo-text-secondary">
                                            <div className="p-1 bg-neo-surface border-2 border-neo-border">
                                                <Clock size={16} />
                                            </div>
                                            {new Date(exam.startTime).toLocaleDateString()} {new Date(exam.startTime).toLocaleTimeString()}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <span className="bg-neo-border text-neo-bg px-2 py-1 border-2 border-neo-border shadow-brutal-sm uppercase text-xs">
                                                ID: {exam.id.split('-')[0]}
                                            </span>
                                        </p>
                                    </div>
                                </BrutalCard>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
