import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Code2, ArrowRight, Mail, Lock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LiquidEther from '../components/ui/LiquidEther';
import { GlassCard, GlassButton, GlassInput, GlassDivider } from '../components/ui/Glass';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGitHubLogin = () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        window.location.href = `${baseUrl}/auth/github`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const url = isLogin ? `${baseUrl}/auth/login` : `${baseUrl}/auth/register`;
        const body = isLogin ? { email, password } : { username, email, password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Authentication failed');
                setLoading(false);
                return;
            }

            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('collab-username', data.user.username);
                navigate('/');
            }
        } catch (err) {
            setError('Could not connect to the server');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden bg-[#02040f]">
            <LiquidEther />

            <motion.div
                className="w-full max-w-[440px] relative z-10"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Logo */}
                <div className="flex flex-col items-center mb-10">
                    <motion.div
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15, duration: 0.5, type: 'spring', stiffness: 200 }}
                    >
                        <Code2 size={32} className="text-white" />
                    </motion.div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                        Colab Cloud
                    </h1>
                    <p className="text-white/40 text-sm font-medium">
                        {isLogin ? 'Sign in to your workspace' : 'Create a new account'}
                    </p>
                </div>

                {/* Card */}
                <GlassCard padding="xl">
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-red-500/15 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300 font-medium text-center">
                                    {error}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    key="username"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="overflow-hidden"
                                >
                                    <GlassInput
                                        label="Username"
                                        type="text"
                                        placeholder="Choose a username"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        icon={<User size={16} />}
                                        required={!isLogin}
                                        autoComplete="username"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <GlassInput
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            icon={<Mail size={16} />}
                            required
                            autoComplete="email"
                        />

                        <GlassInput
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            icon={<Lock size={16} />}
                            required
                        />

                        <GlassButton
                            type="submit"
                            variant="primary"
                            size="lg"
                            loading={loading}
                            className="w-full mt-2 justify-center"
                        >
                            {isLogin ? 'Sign In' : 'Create Account'}
                            {!loading && <ArrowRight size={18} />}
                        </GlassButton>
                    </form>

                    <GlassDivider label="or" />

                    <GlassButton
                        type="button"
                        variant="secondary"
                        size="lg"
                        className="w-full justify-center"
                        onClick={handleGitHubLogin}
                        icon={<Github size={18} />}
                    >
                        Continue with GitHub
                    </GlassButton>

                    <p className="mt-6 text-center text-sm text-white/40">
                        {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                        <button
                            type="button"
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </GlassCard>
            </motion.div>
        </div>
    );
};

export default Login;
