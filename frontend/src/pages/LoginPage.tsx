import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { ErrorNote } from '../components/ErrorNote';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { User } from '../types';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, name: name || undefined, locale: i18n.resolvedLanguage ?? 'en' };
      const user = await api<User>(`/api/auth/${mode}`, { method: 'POST', body });
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-indigo-700">{t('common.appName')}</h1>
          <LanguageSwitcher />
        </div>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="label" htmlFor="name">
                {t('auth.name')} ({t('common.optional')})
              </label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'register' && <p className="text-xs text-gray-500 mt-1">{t('auth.passwordHint')}</p>}
          </div>
          <ErrorNote errorKey={error} />
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
        </form>
        <button
          type="button"
          className="text-sm text-indigo-600 hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}
        </button>
      </div>
    </div>
  );
}
