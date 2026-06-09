import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Key, User, ExternalLink, CheckCircle } from 'lucide-react';
import { saveGithubCredentials } from '../api';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
                className="w-full max-w-md bg-[#0d0d1c] border border-white/15 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            >
                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                            <Github size={20} className="text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                {isUpdate ? 'Update GitHub Credentials' : 'Connect GitHub'}
                            </h2>
                            <p className="text-xs text-white/40">For push &amp; pull in the Git panel</p>
                        </div>
                    </div>

                    <p className="text-white/50 text-sm leading-relaxed mt-4 mb-6">
                        Add your GitHub username and a{' '}
                        <a
                            href="https://github.com/settings/tokens/new?scopes=repo&description=Colab+Code+Editor"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 transition-colors"
                        >
                            Personal Access Token <ExternalLink size={11} />
                        </a>{' '}
                        (classic, <code className="text-white/70 bg-white/10 px-1.5 py-0.5 rounded text-xs">repo</code> scope).
                        Your token is stored in your account and only used for Git operations.
                    </p>

                    <AnimatePresence>
                        {saved ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-3 py-6"
                            >
                                <CheckCircle size={40} className="text-green-400" />
                                <p className="text-white font-semibold">Credentials saved!</p>
                            </motion.div>
                        ) : (
                            <motion.form onSubmit={handleSave} className="flex flex-col gap-4">
                                <AnimatePresence>
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300 font-medium"
                                        >
                                            {error}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        GitHub Username
                                    </label>
                                    <div className="relative">
                                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            placeholder="your-github-username"
                                            className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-white/20"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-white/40 uppercase tracking-widest">
                                        Personal Access Token
                                    </label>
                                    <div className="relative">
                                        <Key size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                                        <input
                                            type="password"
                                            value={pat}
                                            onChange={e => setPat(e.target.value)}
                                            placeholder="ghp_••••••••••••••••"
                                            className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-4 py-3 rounded-xl text-sm outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-white/20 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <button
                                        type="button"
                                        onClick={onComplete}
                                        className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 text-sm font-medium transition-all"
                                    >
                                        {isUpdate ? 'Cancel' : 'Skip for now'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500 hover:text-white font-semibold text-sm transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Saving…' : 'Save & Continue'}
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}
