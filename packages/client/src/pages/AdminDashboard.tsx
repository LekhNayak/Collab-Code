import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, ChevronRight, LogOut, Code2, Trash2, Copy, AlertTriangle } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { getExams, createExam, deleteExam } from '../api';
import type { ExamRoom } from '../api';
import Modal from '../components/ui/Modal';
import PageShell from '../components/ui/PageShell';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import IconTile from '../components/ui/IconTile';
import { useToast } from '../contexts/toast';

const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05, delayChildren: 0.05 }
    }
};

const staggerItem: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }
};

export default function AdminDashboard() {
    const [exams, setExams] = useState<ExamRoom[]>([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [examToDelete, setExamToDelete] = useState<string | null>(null);
    const [alertModalOpen, setAlertModalOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const toast = useToast();
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
            toast.success('Exam created', `"${exam.title}" is ready. Share its room code with your students.`);
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
            const title = exams.find(exam => exam.id === examToDelete)?.title;
            await deleteExam(examToDelete);
            setExams(exams.filter(exam => exam.id !== examToDelete));
            toast.success('Exam deleted', title ? `"${title}" and its student logs were removed.` : undefined);
            setDeleteModalOpen(false);
            setExamToDelete(null);
        } catch (err: any) {
            console.error('Failed to delete exam', err);
            setAlertMessage('Failed to delete exam room.');
            setAlertModalOpen(true);
        }
    };

    return (
        <>
        <PageShell
            title="Proctor dashboard"
            subtitle="Create exam rooms and monitor students live."
            backTo="/"
            backLabel="Hub"
            width="xl"
            actions={<Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={handleLogout}>Log out</Button>}
        >
            <div className="ui-card mb-10 p-5">
                <h2 className="mb-4 text-[15px] font-semibold text-fg">Create a new exam</h2>
                <form
                    className="flex flex-col items-end gap-3 md:flex-row"
                    onSubmit={e => { e.preventDefault(); handleCreate(); }}
                >
                    <div className="w-full flex-1">
                        <Field
                            label="Exam title"
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="e.g. Midterm Algorithms"
                        />
                    </div>
                    <Button type="submit" variant="primary" icon={<Plus size={15} />} className="w-full md:w-auto">
                        Create room
                    </Button>
                </form>
            </div>

            <h2 className="mb-4 text-[15px] font-semibold text-fg">Active exam rooms</h2>

            {loading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <motion.div
                            key={i}
                            className="h-44 rounded-xl bg-surface"
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
                        />
                    ))}
                </div>
            ) : exams.length === 0 ? (
                <div className="ui-card flex flex-col items-center gap-4 px-6 py-14 text-center">
                    <IconTile size={48}><Code2 size={22} /></IconTile>
                    <div>
                        <h3 className="mb-1 text-base font-semibold text-fg">No exams yet</h3>
                        <p className="text-sm text-fg-2">Create your first exam room above to get started.</p>
                    </div>
                </div>
            ) : (
                <motion.div
                    className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                >
                    {exams.map((exam) => (
                        <motion.div key={exam.id} variants={staggerItem}>
                            <div
                                className="ui-card-interactive group flex h-full flex-col p-5"
                                onClick={() => navigate(`/exam/${exam.id}/monitor`)}
                            >
                                <div className="mb-6 flex items-start justify-between gap-3">
                                    <h3 className="line-clamp-2 text-base font-semibold leading-snug text-fg">
                                        {exam.title}
                                    </h3>
                                    <button
                                        type="button"
                                        className="-mr-1.5 -mt-1 shrink-0 rounded-md p-1.5 text-fg-3 transition-colors hover:bg-danger/15 hover:text-danger-text"
                                        onClick={(e) => handleDeleteClick(exam.id, e)}
                                        aria-label={`Delete ${exam.title}`}
                                        title="Delete exam"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div className="mt-auto space-y-3 text-[13px]">
                                    <div className="flex items-center gap-2 text-fg-2">
                                        <Clock size={14} className="text-fg-3" />
                                        {new Date(exam.startTime).toLocaleDateString()} at {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    {exam.roomCode && (
                                        <div className="flex items-center justify-between rounded-lg bg-canvas py-1.5 pl-3 pr-1.5">
                                            <span className="font-mono font-medium text-accent-text">{exam.roomCode}</span>
                                            <button
                                                className="rounded-md p-1.5 text-fg-3 transition-colors hover:bg-tint-3 hover:text-fg"
                                                title="Copy exam code"
                                                aria-label="Copy exam code"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(exam.roomCode!);
                                                }}
                                            >
                                                <Copy size={14} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1 border-t border-line pt-3 font-medium text-accent-text transition-all group-hover:gap-2">
                                        Monitor exam <ChevronRight size={15} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </PageShell>

        <Modal
            isOpen={deleteModalOpen}
            title="Delete exam?"
            icon={<IconTile tone="danger"><Trash2 size={20} /></IconTile>}
            actions={[
                {
                    label: 'Cancel',
                    variant: 'ghost',
                    onClick: () => { setDeleteModalOpen(false); setExamToDelete(null); },
                },
                {
                    label: 'Delete exam',
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
            icon={<IconTile tone="warning"><AlertTriangle size={20} /></IconTile>}
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
        </>
    );
}
