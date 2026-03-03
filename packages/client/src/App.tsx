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
    // Use window.location.href to fully reload the app to update the stale router states
    window.location.href = '/';
    return null;
  }
  return <Navigate to="/login" />;
};

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<AuthCallback />} />
          <Route
            path="/"
            element={<PrivateRoute><Hub /></PrivateRoute>}
          />
          <Route
            path="/collab"
            element={<PrivateRoute><RoomPage /></PrivateRoute>}
          />
          <Route
            path="/room/:roomId"
            element={<PrivateRoute><IDELayout /></PrivateRoute>}
          />
          <Route
            path="/admin"
            element={<PrivateRoute><AdminDashboard /></PrivateRoute>}
          />
          <Route
            path="/exam/:examId/monitor"
            element={<PrivateRoute><AdminMonitor /></PrivateRoute>}
          />
          <Route
            path="/e/:roomId"
            element={<PrivateRoute><IDELayout isExamMode /></PrivateRoute>}
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
