import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { YearProvider } from './context/YearContext';
import { ToastProvider } from './components/ui';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import ActionsPage from './pages/ActionsPage';
import ReportsPage from './pages/ReportsPage';
import ImportPage from './pages/ImportPage';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';

function PrivateRoute({ children, roles }: { children: React.ReactElement; roles?: string[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
      <Route path="/reset-password" element={user ? <Navigate to="/" replace /> : <ResetPasswordPage />} />
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/actions" element={<PrivateRoute><ActionsPage /></PrivateRoute>} />
      {/* /dashboard/regional أُزيل لأنه كان مطابقًا تمامًا لمحتوى "/" لدى المنسق الجهوي والمدير — نُعيد التوجيه لتجنب أي رابط قديم مكسور */}
      <Route path="/dashboard/regional" element={<Navigate to="/" replace />} />
      <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
      <Route path="/import" element={<PrivateRoute><ImportPage /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute roles={['ADMIN']}><UsersPage /></PrivateRoute>} />
      <Route path="/audit-log" element={<PrivateRoute roles={['ADMIN']}><AuditLogPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <YearProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </YearProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
