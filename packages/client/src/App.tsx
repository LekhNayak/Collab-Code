import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import RoomPage from './pages/Room';
import AdminDashboard from './pages/AdminDashboard';
import Hub from './pages/Hub';
import CollabAdmin from './pages/CollabAdmin';
import ExamEntry from './pages/ExamEntry';
import ImportProject from './pages/ImportProject';
import { ThemeProvider } from './contexts/ThemeContext';
import { DialogProvider } from './contexts/DialogContext';
import { ToastProvider } from './contexts/ToastContext';

// The editor pages pull in Monaco (several MB), so they load on demand
const IDELayout = lazy(() => import('./components/IDELayout'));
const AdminMonitor = lazy(() => import('./pages/AdminMonitor'));
const ContestsHome = lazy(() => import('./pages/ContestsHome'));
const ContestManage = lazy(() => import('./pages/ContestManage'));
const ContestMonitor = lazy(() => import('./pages/ContestMonitor'));
const ContestArena = lazy(() => import('./pages/ContestArena'));

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
      <DialogProvider>
      <Router>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000', color: '#969696', padding: 20 }}>Loading...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={<PrivateRoute><Hub /></PrivateRoute>}
          />
          <Route
            path="/collab"
            element={<PrivateRoute><RoomPage /></PrivateRoute>}
          />
          <Route
            path="/take-exam"
            element={<PrivateRoute><ExamEntry /></PrivateRoute>}
          />
          <Route
            path="/import"
            element={<PrivateRoute><ImportProject /></PrivateRoute>}
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
          <Route
            path="/collab-admin/:roomId"
            element={<PrivateRoute><CollabAdmin /></PrivateRoute>}
          />
          <Route
            path="/contests"
            element={<PrivateRoute><ContestsHome /></PrivateRoute>}
          />
          <Route
            path="/contests/:id/manage"
            element={<PrivateRoute><ContestManage /></PrivateRoute>}
          />
          <Route
            path="/contests/:id/monitor"
            element={<PrivateRoute><ContestMonitor /></PrivateRoute>}
          />
          <Route
            path="/c/:code"
            element={<PrivateRoute><ContestArena /></PrivateRoute>}
          />
        </Routes>
        </Suspense>
      </Router>
      </DialogProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
