import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cloneRepository, createSession } from '../api';
import { useToast } from '../contexts/toast';
import PageShell from '../components/ui/PageShell';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import Button from '../components/ui/Button';

function generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `CR-${result}`;
}

export default function ImportProject() {
    const navigate = useNavigate();
    const [repoUrl, setRepoUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoUrl.trim()) {
            setError('Please provide a repository URL.');
            return;
        }
        setImporting(true);
        setError('');
        const username = localStorage.getItem('collab-username') || 'Anonymous';
        const roomId = generateRoomId();
        try {
            await cloneRepository(repoUrl.trim(), roomId);
            await createSession(`Project ${roomId}`, roomId, roomId, username);
            const repoName = repoUrl.trim().replace(/\.git$/, '').split('/').filter(Boolean).pop();
            toast.success('Repository imported', `${repoName ?? 'The repository'} is ready in room ${roomId}.`);
            navigate(`/room/${roomId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to import repository.');
            setImporting(false);
        }
    };

    return (
        <PageShell
            title="Import project"
            subtitle="Clone a public GitHub repository into a collaborative workspace."
            backTo={importing ? undefined : '/'}
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
                            label="GitHub repo URL"
                            type="url"
                            value={repoUrl}
                            onChange={(e) => { setRepoUrl(e.target.value); setError(''); }}
                            placeholder="https://github.com/username/repo.git"
                            required
                            disabled={importing}
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

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={importing}
                            icon={<Download size={16} />}
                            className="mt-1 w-full"
                        >
                            {importing ? 'Cloning…' : 'Clone repository'}
                        </Button>
                    </form>
                </Card>
            </motion.div>
        </PageShell>
    );
}
