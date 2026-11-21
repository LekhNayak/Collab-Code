import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Key, User, ExternalLink, CheckCircle } from 'lucide-react';
import { saveGithubCredentials } from '../api';
import Button from './ui/Button';
import Field from './ui/Field';
import IconTile from './ui/IconTile';
import { useDialogPanel } from './ui/useDialog';

interface GitHubOnboardingProps {
    onComplete: () => void;
    isUpdate?: boolean;
}

export default function GitHubOnboarding({ onComplete, isUpdate = false }: GitHubOnboardingProps) {
    const [username, setUsername] = useState('');
    const [pat, setPat] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    // A real dialog: announced, focus moves in and stays, Esc skips (or cancels), focus goes back afterwards
    const dialog = useDialogPanel<HTMLDivElement>(isUpdate ? 'Update GitHub credentials' : 'Connect GitHub', onComplete);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !pat.trim()) {
            setError('Both fields are required.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await saveGithubCredentials(username.trim(), pat.trim());
            localStorage.setItem('hasGithubCredentials', 'true');
            setSaved(true);
            setTimeout(onComplete, 1200);
        } catch (err: any) {
            setError(err.message || 'Failed to save credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
                {...dialog.props}
                className="w-full max-w-md overflow-hidden rounded-xl bg-raised shadow-float focus:outline-none"
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="p-6">
                    <div className="mb-1 flex items-center gap-3">
                        <IconTile tone="neutral"><Github size={20} /></IconTile>
                        <div>
                            <h2 className="text-base font-semibold text-fg">
                                {isUpdate ? 'Update GitHub credentials' : 'Connect GitHub'}
                            </h2>
                            <p className="text-xs text-fg-3">For push &amp; pull in the Git panel</p>
                        </div>
                    </div>

                    <p className="mb-5 mt-4 text-[13px] leading-relaxed text-fg-2">
                        Add your GitHub username and a{' '}
                        <a
                            href="https://github.com/settings/tokens/new?scopes=repo&description=Colab+Code+Editor"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent-text transition-colors hover:text-fg"
                        >
                            personal access token <ExternalLink size={11} aria-hidden />
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>{' '}
                        (classic, <code className="rounded bg-tint-3 px-1.5 py-0.5 font-mono text-xs text-fg">repo</code> scope).
                        Your token is stored in your account and only used for Git operations.
                    </p>

                    <AnimatePresence initial={false} mode="wait">
                        {saved ? (
                            <motion.div
                                key="saved"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center gap-3 py-6"
                            >
                                <CheckCircle size={36} className="text-success-text" />
                                <p className="text-sm font-medium text-fg">Credentials saved</p>
                            </motion.div>
                        ) : (
                            <motion.form key="form" onSubmit={handleSave} className="flex flex-col gap-4">
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

                                <Field
                                    label="GitHub username"
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="your-github-username"
                                    icon={<User size={15} />}
                                />
                                <Field
                                    label="Personal access token"
                                    type="password"
                                    value={pat}
                                    onChange={e => setPat(e.target.value)}
                                    placeholder="ghp_••••••••••••••••"
                                    icon={<Key size={15} />}
                                    className="font-mono"
                                />

                                <div className="mt-2 flex justify-end gap-2">
                                    <Button type="button" variant="ghost" onClick={onComplete}>
                                        {isUpdate ? 'Cancel' : 'Skip for now'}
                                    </Button>
                                    <Button type="submit" variant="primary" loading={loading}>
                                        {loading ? 'Saving…' : 'Save and continue'}
                                    </Button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
