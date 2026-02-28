import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Mail, Lock, User, ArrowRight, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGitHubLogin = () => {
        window.location.href = 'http://localhost:3001/auth/github';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const url = isLogin
            ? 'http://localhost:3001/auth/login'
            : 'http://localhost:3001/auth/register';

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
        <div className="min-h-screen bg-[#1e1e1e] text-[#cccccc] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">

            {/* Background Decorations */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#007acc] rounded-full blur-[120px] opacity-10" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#4ec9b0] rounded-full blur-[120px] opacity-10" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md bg-[#252526] border border-[#333333] rounded-xl p-8 shadow-2xl relative z-10"
            >
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1e1e1e] border border-[#3c3c3c] mb-6 shadow-inner"
                    >
                        <Code2 size={32} className="text-[#007acc]" />
                    </motion.div>
                    <h1 className="text-2xl font-semibold mb-2 text-white">
                        Colab Code Editor
                    </h1>
                    <p className="text-[#969696] text-sm">
                        {isLogin ? 'Sign in to access your workspaces' : 'Create an account to start collaborating'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mb-6 bg-[#f44747]/10 border border-[#f44747]/50 text-[#f44747] p-3 rounded text-sm text-center">
                                {error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 mb-6">
                    <AnimatePresence mode="popLayout">
                        {!isLogin && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                transition={{ duration: 0.3 }}
                            >
                                <label className="flex items-center gap-2 text-xs text-[#969696] mb-1.5 font-medium ml-1">
                                    <User size={14} /> Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Choose a username"
                                    required
                                    className="w-full bg-[#3c3c3c] border border-transparent rounded p-2.5 text-white placeholder-[#6a6a6a] focus:bg-[#3c3c3c] focus:border-[#007acc] focus:outline-none transition-colors text-sm"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-[#969696] mb-1.5 font-medium ml-1">
                            <Mail size={14} /> Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            className="w-full bg-[#3c3c3c] border border-transparent rounded p-2.5 text-white placeholder-[#6a6a6a] focus:bg-[#3c3c3c] focus:border-[#007acc] focus:outline-none transition-colors text-sm"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-[#969696] mb-1.5 font-medium ml-1">
                            <Lock size={14} /> Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            className="w-full bg-[#3c3c3c] border border-transparent rounded p-2.5 text-white placeholder-[#6a6a6a] focus:bg-[#3c3c3c] focus:border-[#007acc] focus:outline-none transition-colors text-sm"
                        />
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        type="submit"
                        disabled={loading}
                        className="mt-4 w-full bg-[#007acc] hover:bg-[#1a8ad4] disabled:opacity-50 text-white py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 font-medium"
                    >
                        {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Sign Up')}
                        {!loading && <ArrowRight size={16} />}
                    </motion.button>
                </form>

                <div className="relative flex items-center py-5">
                    <div className="flex-grow border-t border-[#3c3c3c]"></div>
                    <span className="flex-shrink-0 mx-4 text-[#6a6a6a] text-xs uppercase tracking-wider">or</span>
                    <div className="flex-grow border-t border-[#3c3c3c]"></div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.01, backgroundColor: '#3c3c3c' }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={handleGitHubLogin}
                    className="w-full bg-[#2d2d2d] text-white py-2.5 px-4 rounded border border-[#3c3c3c] transition-colors flex items-center justify-center gap-3 font-medium text-sm"
                >
                    <Github size={18} /> Continue with GitHub
                </motion.button>

                <p className="mt-8 text-center text-sm text-[#969696]">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                        className="text-[#007acc] hover:text-[#1a8ad4] transition-colors focus:outline-none"
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
