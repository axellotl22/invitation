import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewInvitationPage } from './pages/NewInvitationPage';
import { InvitationDetailPage } from './pages/InvitationDetailPage';
import { PublicInvitationPage } from './pages/PublicInvitationPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="p-12 text-center text-gray-500">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/i/:slug" element={<PublicInvitationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/dashboard/new"
          element={
            <Protected>
              <NewInvitationPage />
            </Protected>
          }
        />
        <Route
          path="/dashboard/:id"
          element={
            <Protected>
              <InvitationDetailPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
