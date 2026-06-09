import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Layout } from '../components/Layout';
import type { Invitation } from '../types';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);

  useEffect(() => {
    api<Invitation[]>('/api/invitations').then(setInvitations).catch(() => setInvitations([]));
  }, []);

  const dateFmt = new Intl.DateTimeFormat(i18n.resolvedLanguage === 'de' ? 'de-DE' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">{t('dashboard.title')}</h1>
        <Link to="/dashboard/new" className="btn-primary">
          + {t('dashboard.new')}
        </Link>
      </div>
      {invitations === null ? (
        <p className="text-gray-500">{t('common.loading')}</p>
      ) : invitations.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">{t('dashboard.empty')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invitations.map((inv) => (
            <Link key={inv.id} to={`/dashboard/${inv.id}`} className="card overflow-hidden hover:shadow-md transition-shadow">
              {inv.imageUrl && <img src={inv.imageUrl} alt="" className="h-32 w-full object-cover" />}
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-lg truncate">{inv.title}</h2>
                  {!inv.isOpen && (
                    <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 whitespace-nowrap">
                      {t('dashboard.closed')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{dateFmt.format(new Date(inv.startsAt))}</p>
                {inv.stats && (
                  <div className="flex gap-4 text-sm pt-1">
                    <span className="text-emerald-700 font-medium">
                      ✓ {inv.stats.attending} {t('dashboard.attending')}
                    </span>
                    <span className="text-rose-700 font-medium">
                      ✗ {inv.stats.declined} {t('dashboard.declined')}
                    </span>
                    <span className="text-gray-500">
                      {inv.stats.responded}/{inv.stats.households} {t('dashboard.responded')}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
