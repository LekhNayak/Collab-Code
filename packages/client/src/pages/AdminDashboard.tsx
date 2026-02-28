import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Clock, ChevronRight, LogOut } from 'lucide-react';
import { getExams, createExam } from '../api';
import type { ExamRoom } from '../api';

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
        <div className="flex h-screen bg-[#1e1e1e] text-white p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-400" />
                        Exam Admin Dashboard
                    </h1>
                    <button onClick={handleLogout} className="text-[#969696] hover:text-white flex items-center gap-2 transition-colors text-sm">
                        <LogOut size={18} /> Logout
                    </button>
                </div>

                <div className="bg-[#252526] rounded-xl p-6 border border-[#333] shadow-lg mb-8 transition-transform hover:-translate-y-1">
                    <h2 className="text-xl font-semibold mb-4 text-[#d4d4d4]">Create New Exam</h2>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Exam Title (e.g., Midterm Algorithms)"
                            className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-4 py-2 focus:border-blue-500 focus:outline-none transition-colors"
                        />
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded flex items-center gap-2 transition-colors font-medium"
                        >
                            <Plus size={18} /> Create Room
                        </button>
                    </div>
                </div>

                <h2 className="text-2xl font-bold mb-6 mt-12 border-b border-[#3c3c3c] pb-2">Your Exam Rooms</h2>

                {loading ? (
                    <div className="text-[#969696] animate-pulse">Loading exams...</div>
                ) : exams.length === 0 ? (
                    <div className="text-[#969696] bg-[#252526] p-8 rounded-xl text-center border border-[#333]">
                        No exams created yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {exams.map(exam => (
                            <div
                                key={exam.id}
                                className="bg-[#252526] rounded-xl p-6 border border-[#333] hover:border-[#666] transition-all cursor-pointer shadow-md hover:shadow-xl group"
                                onClick={() => navigate(`/exam/${exam.id}/monitor`)}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold text-blue-400 group-hover:text-blue-300 transition-colors line-clamp-2">{exam.title}</h3>
                                    <ChevronRight className="text-[#555] group-hover:text-white transition-colors" />
                                </div>
                                <div className="space-y-2 text-[#969696] text-sm font-mono">
                                    <p className="flex items-center gap-2">
                                        <Clock size={14} />
                                        {new Date(exam.startTime).toLocaleDateString()} {new Date(exam.startTime).toLocaleTimeString()}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="bg-[#3c3c3c] text-xs px-2 py-0.5 rounded text-gray-300">ID: {exam.id.split('-')[0]}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
