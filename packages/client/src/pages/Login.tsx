import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import Card from '../components/ui/Card';
import Wordmark from '../components/ui/Wordmark';
import { API_BASE } from '../config';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const baseUrl = API_BASE;
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
                localStorage.setItem('hasGithubCredentials', data.hasGithubCredentials ? 'true' : 'false');
                if (data.isNewUser) {
                    localStorage.setItem('needsGitHubSetup', 'true');
                }
                navigate('/');
            }
        } catch (err) {
            setError('Could not connect to the server');
            setLoading(false);
        }
    };

    return (
        <div className="flex h-[100dvh] w-full flex-col items-center justify-center overflow-y-auto bg-canvas p-6 font-sans">
            <motion.div
                className="w-full max-w-[400px]"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="mb-8 flex flex-col items-center text-center">
                    <Wordmark className="mb-6 !text-base" />
                    <h1 className="text-2xl font-semibold tracking-tight text-fg">
                        {isLogin ? 'Sign in to your workspace' : 'Create your account'}
                    </h1>
                    <p className="mt-1.5 text-sm text-fg-2">
                        {isLogin ? 'Code together, compete and take exams in one place.' : 'It takes a few seconds.'}
                    </p>
                </div>

                <Card padding="lg">
                    <AnimatePresence initial={false}>
                        {error && (
                            <motion.div
                                key="error"
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                className="overflow-hidden"
                            >
                                <div role="alert" className="rounded-lg bg-danger/15 px-3 py-2.5 text-[13px] text-danger-text">
                                    {error}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <AnimatePresence initial={false}>
                            {!isLogin && (
                                <motion.div
                                    key="username"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="-mx-1 overflow-hidden px-1 pb-1 -mb-1"
                                >
                                    <Field
                                        label="Username"
                                        type="text"
                                        placeholder="Choose a username"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        icon={<User size={15} />}
                                        required={!isLogin}
                                        autoComplete="username"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Field
                            label="Email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            icon={<Mail size={15} />}
                            required
                            autoComplete="email"
                        />

                        <Field
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            icon={<Lock size={15} />}
                            required
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                        />

                        <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
                            {isLogin ? 'Sign in' : 'Create account'}
                            {!loading && <ArrowRight size={16} />}
                        </Button>
                    </form>
                </Card>

                <p className="mt-6 text-center text-[13px] text-fg-2">
                    {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="font-medium text-accent-text transition-colors hover:text-fg"
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </motion.div>
        </div>
    );
}

export default Login;
