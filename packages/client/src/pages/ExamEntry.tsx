import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Button from '../components/ui/Button';

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
        <PageShell
            title="Take an exam"
            subtitle="Enter your details to open the secure exam environment."
            backTo="/"
            backLabel="Hub"
            width="sm"
            centered
        >
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
                <Card padding="lg">
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <Field
                            label="Full name"
                            type="text"
                            value={studentName}
                            onChange={(e) => { setStudentName(e.target.value); setError(''); }}
                            placeholder="e.g. John Doe"
                            required
                        />
                        <Field
                            label="Exam ID"
                            type="text"
                            value={examId}
                            onChange={(e) => { setExamId(e.target.value); setError(''); }}
                            placeholder="EX-xxxxxxxx"
                            required
                            className="font-mono"
                        />

                        <AnimatePresence initial={false}>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div role="alert" className="rounded-lg bg-danger/15 px-3 py-2.5 text-[13px] text-danger-text">
                                        {error}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Button type="submit" variant="primary" size="lg" icon={<BookOpen size={16} />} className="mt-1 w-full">
                            Enter exam
                        </Button>
                    </form>
                </Card>
            </motion.div>
        </PageShell>
    );
}
