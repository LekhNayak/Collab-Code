import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Shield, ArrowRight, BookOpen, Code2 } from 'lucide-react';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center justify-center p-6 font-sans relative">
            <div className="absolute top-6 right-6 flex items-center gap-4">
                <BrutalButton variant="danger" size="sm" onClick={() => {
                    localStorage.removeItem('token');
                    navigate('/login');
                }}>
                    LOGOUT
                </BrutalButton>
                <ThemeToggle />
            </div>

            <div className="max-w-6xl w-full relative z-10">
                <div className="text-center mb-16 flex flex-col items-center">
                    <div className="w-24 h-24 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-8">
                        <Code2 size={48} className="text-neo-text" />
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black mb-4 uppercase tracking-tighter shadow-sm text-neo-text">
                        Welcome to Colab Cloud
                    </h1>
                    <p className="font-bold text-xl uppercase max-w-2xl mx-auto tracking-wide">
                        Choose your destination. Hop into a pair programming session, take an exam, or monitor a live test.
                    </p>
                </div>

                {activeTab === 'selection' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Collab Card */}
                        <BrutalCard hoverable onClick={() => navigate('/collab')} className="flex flex-col items-center text-center h-full">
                            <div className="w-20 h-20 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6">
                                <Users size={40} className="text-neo-border" />
                            </div>
                            <h2 className="text-3xl font-black mb-4 uppercase">Collaboration</h2>
                            <p className="font-semibold mb-8 flex-1 text-lg">
                                Create or join real-time coding rooms. Pair program, share files, and execute code together.
                            </p>
                            <BrutalButton className="w-full text-xl mt-auto">
                                OPEN HUB <ArrowRight size={20} />
                            </BrutalButton>
                        </BrutalCard>

                        {/* Student Card */}
                        <BrutalCard hoverable onClick={() => setActiveTab('student')} className="flex flex-col items-center text-center h-full">
                            <div className="w-20 h-20 bg-neo-surface border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6">
                                <GraduationCap size={40} className="text-neo-border" />
                            </div>
                            <h2 className="text-3xl font-black mb-4 uppercase">Take an Exam</h2>
                            <p className="font-semibold mb-8 flex-1 text-lg">
                                Log in as a student to join a secure, monitored examination room. Requires a valid Exam ID.
                            </p>
                            <BrutalButton className="w-full text-xl mt-auto">
                                ENTER PORTAL <ArrowRight size={20} />
                            </BrutalButton>
                        </BrutalCard>

                        {/* Admin Card */}
                        <BrutalCard hoverable onClick={() => navigate('/admin')} className="flex flex-col items-center text-center h-full">
                            <div className="w-20 h-20 bg-neo-error border-4 border-neo-border flex items-center justify-center shadow-brutal-sm mb-6">
                                <Shield size={40} className="text-white" />
                            </div>
                            <h2 className="text-3xl font-black mb-4 uppercase text-neo-error">Proctor Area</h2>
                            <p className="font-semibold mb-8 flex-1 text-lg">
                                For teachers and admins. Deploy exams, monitor students in real-time, and view comprehensive logs.
                            </p>
                            <BrutalButton variant="danger" className="w-full text-xl mt-auto">
                                DASHBOARD <ArrowRight size={20} />
                            </BrutalButton>
                        </BrutalCard>
                    </div>
                ) : (
                    <div className="max-w-lg mx-auto">
                        <BrutalCard>
                            <div className="flex items-center gap-4 mb-8">
                                <BrutalButton size="sm" onClick={() => setActiveTab('selection')} className="px-3 py-2">
                                    <ArrowRight className="rotate-180" size={24} />
                                </BrutalButton>
                                <h2 className="text-3xl font-black uppercase">Join Secure Exam</h2>
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

                                {error && (
                                    <div className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm">
                                        {error}
                                    </div>
                                )}

                                <BrutalButton type="submit" variant="primary" size="lg" className="mt-4 text-xl tracking-wide uppercase">
                                    <BookOpen size={24} /> Enter Environment
                                </BrutalButton>
                            </form>
                        </BrutalCard>
                    </div>
                )}
            </div>
        </div>
    );
}
