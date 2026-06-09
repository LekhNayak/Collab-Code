import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cloneRepository, createSession } from '../api';
import LiquidEther from '../components/ui/LiquidEther';

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
            navigate(`/room/${roomId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to import repository.');
            setImporting(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-black text-white flex flex-col items-center justify-center p-4 md:p-8 font-sans relative overflow-hidden">
            <LiquidEther className="absolute inset-0 z-0 opacity-100" />

            <div className="absolute top-6 left-6 z-20">
                <button
                    onClick={() => navigate('/')}
                    disabled={importing}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold shadow-sm group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Hub
                </button>
            </div>

            <div className="max-w-lg w-full relative z-10 mt-12 md:mt-0">
                <motion.div
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <motion.div
                        className="w-16 h-16 bg-[#10b981]/90 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)] mx-auto mb-5"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                        <Github size={32} className="text-white" />
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
                        Import Project
                    </h1>
                    <p className="font-medium text-white/50 text-base">
                        Clone a public GitHub repository into a collaborative workspace
                    </p>
                </motion.div>

                <motion.div
                    className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl"
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                >
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest pl-1">
                                GitHub Repo URL
                            </label>
                            <input
                                type="url"
                                value={repoUrl}
                                onChange={(e) => { setRepoUrl(e.target.value); setError(''); }}
                                placeholder="https://github.com/username/repo.git"
                                required
                                disabled={importing}
                                className="w-full bg-black/20 border border-white/10 text-white px-5 py-4 rounded-xl outline-none focus:border-[#10b981]/50 focus:ring-2 focus:ring-[#10b981]/20 transition-all text-base font-medium shadow-inner placeholder:text-white/30 disabled:opacity-50"
                            />
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-red-500/20 border border-red-500/30 text-red-200 rounded-xl p-4 font-semibold text-center text-sm shadow-lg"
                                >
                                    {error}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={importing}
                            className="mt-2 w-full h-[56px] rounded-xl bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-bold text-base tracking-wide transition-all shadow-lg shadow-[#10b981]/20 flex items-center justify-center gap-3 disabled:opacity-70"
                        >
                            {importing ? (
                                <><Loader2 className="animate-spin" size={20} /> Cloning...</>
                            ) : (
                                <><Download size={20} /> Clone Repository</>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </div>
    );
}
