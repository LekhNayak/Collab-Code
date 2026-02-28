import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import RoomPage from './pages/Room';
import IDELayout from './components/IDELayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminMonitor from './pages/AdminMonitor';
import Hub from './pages/Hub';
import { ThemeProvider } from './contexts/ThemeContext';

const AuthCallback: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) {
    localStorage.setItem('token', token);
    return <Navigate to="/" />;
  }
  return <Navigate to="/login" />;
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={isAuthenticated ? <Hub /> : <Navigate to="/login" />}
          />
          <Route
            path="/collab"
            element={isAuthenticated ? <RoomPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/room/:roomId"
            element={isAuthenticated ? <IDELayout /> : <Navigate to="/login" />}
          />
          <Route
            path="/admin"
            element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/login" />}
          />
          <Route
            path="/exam/:examId/monitor"
            element={isAuthenticated ? <AdminMonitor /> : <Navigate to="/login" />}
          />
          <Route
            path="/e/:examId"
            element={isAuthenticated ? <IDELayout isExamMode /> : <Navigate to="/login" />}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
