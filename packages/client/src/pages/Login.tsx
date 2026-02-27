import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const navigate = useNavigate();

    const handleGitHubLogin = () => {
        window.location.href = 'http://localhost:3001/auth/github';
    };

    const handleGuestLogin = async () => {
        try {
            const res = await fetch('http://localhost:3001/auth/guest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('collab-username', data.user.username);
                navigate('/');
            }
        } catch (err) {
            console.error('Guest login failed', err);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            flexDirection: 'column',
            gap: '20px',
            backgroundColor: '#1e1e1e',
            color: 'white'
        }}>
            <h1>Welcome to Colab Code Editor</h1>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button
                    onClick={handleGitHubLogin}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        backgroundColor: '#333',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: '4px'
                    }}
                >
                    Login with GitHub
                </button>
                <button
                    onClick={handleGuestLogin}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        backgroundColor: '#007acc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                    }}
                >
                    Guest Login (Dev)
                </button>
            </div>
        </div>
    );
};

export default Login;
