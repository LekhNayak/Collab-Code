import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ChevronRight, LogOut, Code2 } from 'lucide-react';
import { getExams, createExam } from '../api';
import type { ExamRoom } from '../api';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
            <div className="absolute top-6 right-6 flex items-center gap-4">
                <ThemeToggle />
            </div>

            <div className="max-w-6xl mx-auto w-full">
                <div className="flex justify-between items-center mb-12 border-b-4 border-neo-border pb-6 mt-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal-sm">
                            <Users size={32} className="text-neo-text" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black uppercase tracking-tighter shadow-sm text-neo-text">
                                Proctor Dashboard
                            </h1>
                            <p className="font-bold text-lg uppercase">Exam Management</p>
                        </div>
                    </div>
                    <BrutalButton variant="danger" size="sm" onClick={handleLogout} className="flex gap-2">
                        <LogOut size={18} /> LOGOUT
                    </BrutalButton>
                </div>

                <BrutalCard className="mb-12">
                    <h2 className="text-2xl font-black uppercase mb-4">Create New Exam</h2>
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

                <h2 className="text-3xl font-black mb-8 uppercase border-b-4 border-neo-border pb-2 inline-block">Active Exam Rooms</h2>

                {loading ? (
                    <div className="text-xl font-bold animate-pulse text-neo-text">Loading exams...</div>
                ) : exams.length === 0 ? (
                    <BrutalCard className="text-center py-12">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-neo-surface border-4 border-neo-border flex items-center justify-center shadow-brutal-sm">
                                <Code2 size={32} className="text-neo-text opacity-50" />
                            </div>
                            <h3 className="text-2xl font-black uppercase">No Exams Created Yet</h3>
                            <p className="font-bold">Create an exam room to get started.</p>
                        </div>
                    </BrutalCard>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {exams.map(exam => (
                            <BrutalCard
                                key={exam.id}
                                hoverable
                                className="cursor-pointer flex flex-col h-full"
                                onClick={() => navigate(`/exam/${exam.id}/monitor`)}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-black uppercase line-clamp-2">{exam.title}</h3>
                                    <div className="bg-neo-accent p-2 border-2 border-neo-border shadow-brutal-sm">
                                        <ChevronRight size={20} className="text-neo-text" />
                                    </div>
                                </div>
                                <div className="space-y-4 font-bold text-sm mt-auto">
                                    <p className="flex items-center gap-2">
                                        <div className="p-1 bg-neo-surface border-2 border-neo-border">
                                            <Clock size={16} />
                                        </div>
                                        {new Date(exam.startTime).toLocaleDateString()} {new Date(exam.startTime).toLocaleTimeString()}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="bg-neo-border text-neo-bg px-2 py-1 border-2 border-neo-border shadow-brutal-sm uppercase">
                                            ID: {exam.id.split('-')[0]}
                                        </span>
                                    </p>
                                </div>
                            </BrutalCard>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
