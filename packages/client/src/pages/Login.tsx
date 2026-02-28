import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Github, Code2, ArrowRight } from 'lucide-react';
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
        <div className="min-h-screen bg-neo-bg text-neo-text flex flex-col items-center justify-center p-6 font-sans relative">
            <div className="absolute top-6 right-6">
                <ThemeToggle />
            </div>

            <div className="w-full max-w-md">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-neo-accent border-4 border-neo-border flex items-center justify-center shadow-brutal mb-6">
                        <Code2 size={32} className="text-neo-border" />
                    </div>
                    <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">
                        Colab Code
                    </h1>
                    <p className="font-bold">
                        {isLogin ? 'Sign in to access your workspaces' : 'Create an account to start collaborating'}
                    </p>
                </div>

                <BrutalCard className="w-full">
                    {error && (
                        <div className="mb-6 bg-neo-error text-white font-bold border-2 border-neo-border p-4 text-center shadow-brutal-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-6">
                        {!isLogin && (
                            <BrutalInput
                                label="Username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a username"
                                required
                            />
                        )}

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
                            {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Sign Up')}
                            {!loading && <ArrowRight size={24} />}
                        </BrutalButton>
                    </form>

                    <div className="relative flex items-center py-5">
                        <div className="flex-grow border-t-2 border-neo-border"></div>
                        <span className="flex-shrink-0 mx-4 font-black text-sm uppercase">OR</span>
                        <div className="flex-grow border-t-2 border-neo-border"></div>
                    </div>

                    <BrutalButton type="button" variant="secondary" className="w-full" onClick={handleGitHubLogin}>
                        <Github size={20} /> Continue with GitHub
                    </BrutalButton>

                    <div className="mt-8 text-center font-bold">
                        {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            className="text-neo-accent bg-neo-border px-2 py-1 ml-2 transition-all hover:-translate-y-0.5 shadow-brutal-sm"
                        >
                            {isLogin ? 'SIGN UP' : 'SIGN IN'}
                        </button>
                    </div>
                </BrutalCard>
            </div>
        </div>
    );
};

export default Login;
