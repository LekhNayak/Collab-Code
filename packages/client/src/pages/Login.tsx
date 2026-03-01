import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Code2, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BrutalCard from '../components/ui/BrutalCard';
import BrutalButton from '../components/ui/BrutalButton';
import BrutalInput from '../components/ui/BrutalInput';
import ThemeToggle from '../components/ThemeToggle';

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
        const url = isLogin
            ? `${baseUrl}/auth/login`
            : `${baseUrl}/auth/register`;

        const body = isLogin
            ? { email, password }
            : { username, email, password };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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
            console.error('Auth request failed', err);
            setError('Could not connect to the server');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
            {/* Animated background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute w-32 h-32 border-4 border-neo-border opacity-[0.06]"
                    style={{ top: '10%', left: '5%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                    className="absolute w-24 h-24 bg-neo-accent opacity-[0.08]"
                    style={{ bottom: '15%', right: '10%', borderRadius: '0' }}
                    animate={{ y: [-10, 10, -10], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute w-16 h-16 border-4 border-neo-accent opacity-[0.06]"
                    style={{ top: '60%', left: '15%', borderRadius: '50%' }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="absolute top-6 right-6 z-20">
                <ThemeToggle />
            </div>

            <motion.div
                className="w-full max-w-md relative z-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
                <div className="flex flex-col items-center mb-8">
                    <motion.div
                        className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-6"
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    >
                        <Code2 size={32} className="text-neo-accent-text" />
                    </motion.div>
                    <motion.h1
                        className="text-4xl font-black mb-2 uppercase tracking-tight text-neo-text"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                    >
                        Colab Code
                    </motion.h1>
                    <motion.p
                        className="font-bold text-neo-text-secondary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                    >
                        {isLogin ? 'Sign in to access your workspaces' : 'Create an account to start collaborating'}
                    </motion.p>
                </div>

                <BrutalCard className="w-full">
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                className="bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm overflow-hidden"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-6">
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    key="username-field"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <BrutalInput
                                        label="Username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Choose a username"
                                        required
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <BrutalInput
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />

                        <BrutalInput
                            label="Password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />

                        <BrutalButton type="submit" variant="primary" size="lg" disabled={loading} className="mt-2 text-xl tracking-wide uppercase">
                            {loading ? (
                                <motion.span
                                    className="flex items-center gap-2"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <Loader2 size={24} className="animate-spin" />
                                    Authenticating...
                                </motion.span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {isLogin ? 'Sign In' : 'Sign Up'}
                                    <ArrowRight size={24} />
                                </span>
                            )}
                        </BrutalButton>
                    </form>

                    <div className="relative flex items-center py-5">
                        <div className="flex-grow border-t-2 border-neo-border"></div>
                        <span className="flex-shrink-0 mx-4 font-black text-sm uppercase text-neo-text">OR</span>
                        <div className="flex-grow border-t-2 border-neo-border"></div>
                    </div>

                    <BrutalButton type="button" variant="secondary" className="w-full" onClick={handleGitHubLogin}>
                        <Github size={20} /> Continue with GitHub
                    </BrutalButton>

                    <div className="mt-8 text-center font-bold text-neo-text">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                        <motion.button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="bg-neo-accent text-neo-accent-text px-3 py-1 ml-2 border-2 border-neo-border font-black uppercase text-sm"
                            style={{ boxShadow: '2px 2px 0px 0px var(--neo-shadow)' }}
                            whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0px 0px var(--neo-shadow)' }}
                            whileTap={{ x: 2, y: 2, boxShadow: '0px 0px 0px 0px var(--neo-shadow)' }}
                        >
                            {isLogin ? 'SIGN UP' : 'SIGN IN'}
                        </motion.button>
                    </div>
                </BrutalCard>
            </motion.div>
        </div>
    );
};

export default Login;
