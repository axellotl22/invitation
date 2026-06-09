import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvitationDetail } from '../../types';

export function OverviewTab({ invitation }: { invitation: InvitationDetail }) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const lang = i18n.resolvedLanguage === 'de' ? 'de' : 'en';
  const shareUrl = `${window.location.origin}/i/${invitation.slug}`;
  const dateFmt = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stats = invitation.stats;
  const statItems = [
    { label: t('dashboard.households'), value: stats.households, cls: 'text-gray-900' },
    { label: t('dashboard.responded'), value: stats.responded, cls: 'text-indigo-700' },
    { label: t('dashboard.pending'), value: stats.pending, cls: 'text-amber-600' },
    { label: t('dashboard.attending'), value: stats.attending, cls: 'text-emerald-700' },
    { label: t('dashboard.declined'), value: stats.declined, cls: 'text-rose-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">{t('overview.shareLink')}:</span>
        <code className="text-sm bg-gray-100 rounded px-2 py-1">{shareUrl}</code>
        <button type="button" className="btn-secondary" onClick={() => void copy()}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
        <a className="btn-secondary ml-auto" href={`/api/invitations/${invitation.id}/rsvps.csv?lang=${lang}`}>
          {t('overview.exportCsv')}
        </a>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statItems.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className={`text-2xl font-semibold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <h2 className="px-4 pt-4 font-semibold">{t('overview.responses')}</h2>
        {invitation.households.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">{t('overview.noHouseholds')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm mt-3">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2 font-medium">{t('overview.household')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.status')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.members')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.message')}</th>
                  <th className="px-4 py-2 font-medium">{t('overview.respondedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {invitation.households.map((h) => (
                  <tr key={h.id} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="px-4 py-2 font-medium">{h.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          h.rsvpStatus === 'RESPONDED'
                            ? 'inline-block rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs'
                            : 'inline-block rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs'
                        }
                      >
                        {t(`overview.status${h.rsvpStatus}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <ul className="space-y-0.5">
                        {h.members.map((m) => (
                          <li key={m.id}>
                            {m.attending === true && <span className="text-emerald-700">✓ </span>}
                            {m.attending === false && <span className="text-rose-700">✗ </span>}
                            {m.attending === null && <span className="text-gray-400">? </span>}
                            {m.name}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-56">{h.message}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {h.respondedAt ? dateFmt.format(new Date(h.respondedAt)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
