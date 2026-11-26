import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PublicPassPage } from './pages/PublicPassPage';
import { DashboardPage } from './pages/DashboardPage';
import { VisitorsPage } from './pages/VisitorsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PassesPage } from './pages/PassesPage';
import { ScannerPage } from './pages/ScannerPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminPage } from './pages/AdminPage';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading GatePass...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/verify" element={<PublicPassPage />} />
      <Route path="/verify/:passCode" element={<PublicPassPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="scanner"
          element={
            <ProtectedRoute roles={['admin', 'security']}>
              <ScannerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="visitors"
          element={
            <ProtectedRoute roles={['admin', 'security', 'employee']}>
              <VisitorsPage />
            </ProtectedRoute>
          }
        />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="passes" element={<PassesPage />} />
        <Route
          path="reports"
          element={
            <ProtectedRoute roles={['admin', 'security', 'employee']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <ProtectedRoute roles={['admin', 'security', 'employee']}>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
