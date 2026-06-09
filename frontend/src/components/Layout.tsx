import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useAuth } from '../auth';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    setUser(null);
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-semibold text-indigo-700 text-lg">
            {t('common.appName')}
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && (
              <button type="button" onClick={() => void logout()} className="text-sm text-gray-500 hover:text-gray-800">
                {t('common.logout')}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
