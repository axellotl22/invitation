import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api';
import { ErrorNote } from '../ErrorNote';
import type { InvitationDetail } from '../../types';

export function GuestsTab({ invitation, reload }: { invitation: InvitationDetail; reload: () => void }) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [members, setMembers] = useState<string[]>(['']);
  const [bulkText, setBulkText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      reload();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addHousehold(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      api(`/api/invitations/${invitation.id}/households`, {
        method: 'POST',
        body: { name, email: email || null, members: members.map((m) => m.trim()).filter(Boolean) },
      }),
    );
    if (ok) {
      setName('');
      setEmail('');
      setMembers(['']);
      setShowAdd(false);
    }
  }

  async function bulkAdd(e: React.FormEvent) {
    e.preventDefault();
    const households = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [hhName, memberPart, emailPart] = line.split(';').map((p) => p.trim());
        const memberNames = (memberPart ?? '').split(',').map((m) => m.trim()).filter(Boolean);
        return {
          name: hhName,
          email: emailPart || null,
          members: memberNames.length > 0 ? memberNames : [hhName],
        };
      });
    if (households.length === 0) return;
    const ok = await run(() =>
      api(`/api/invitations/${invitation.id}/households/bulk`, { method: 'POST', body: { households } }),
    );
    if (ok) {
      setBulkText('');
      setShowBulk(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => setShowAdd(!showAdd)}>
          + {t('guests.addHousehold')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setShowBulk(!showBulk)}>
          {t('guests.bulkAdd')}
        </button>
      </div>
      <ErrorNote errorKey={error} />

      {showAdd && (
        <form onSubmit={(e) => void addHousehold(e)} className="card p-4 space-y-3 max-w-lg">
          <div>
            <label className="label" htmlFor="hh-name">
              {t('guests.name')}
            </label>
            <input id="hh-name" className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="hh-email">
              {t('guests.email')} ({t('common.optional')})
            </label>
            <input id="hh-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <span className="label">{t('guests.members')}</span>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input"
                    required
                    placeholder={t('guests.memberName')}
                    value={m}
                    onChange={(e) => setMembers(members.map((v, j) => (i === j ? e.target.value : v)))}
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      className="btn-danger px-3"
                      onClick={() => setMembers(members.filter((_, j) => j !== i))}
                    >
                      ✗
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="text-sm text-indigo-600 hover:underline mt-2" onClick={() => setMembers([...members, ''])}>
              + {t('guests.addMember')}
            </button>
          </div>
          <button type="submit" disabled={busy} className="btn-primary">
            {t('common.add')}
          </button>
        </form>
      )}

      {showBulk && (
        <form onSubmit={(e) => void bulkAdd(e)} className="card p-4 space-y-3 max-w-lg">
          <p className="text-sm text-gray-600">{t('guests.bulkHelp')}</p>
          <textarea
            className="input min-h-32 font-mono text-xs"
            placeholder={t('guests.bulkPlaceholder')}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <button type="submit" disabled={busy} className="btn-primary">
            {t('common.add')}
          </button>
        </form>
      )}

      {invitation.households.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('guests.empty')}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-4 py-2 font-medium">{t('overview.household')}</th>
                <th className="px-4 py-2 font-medium">{t('guests.members')}</th>
                <th className="px-4 py-2 font-medium">{t('guests.email')}</th>
                <th className="px-4 py-2 font-medium">{t('guests.pin')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {invitation.households.map((h) => (
                <tr key={h.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium">{h.name}</td>
                  <td className="px-4 py-2 text-gray-600">{h.members.map((m) => m.name).join(', ')}</td>
                  <td className="px-4 py-2 text-gray-600">{h.email}</td>
                  <td className="px-4 py-2">
                    <code className="bg-gray-100 rounded px-2 py-0.5 tracking-widest">{h.pin}</code>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={busy}
                      className="text-sm text-indigo-600 hover:underline mr-3"
                      onClick={() => void run(() => api(`/api/households/${h.id}/regenerate-pin`, { method: 'POST' }))}
                    >
                      {t('guests.regeneratePin')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => {
                        if (window.confirm(t('common.confirmDelete'))) {
                          void run(() => api(`/api/households/${h.id}`, { method: 'DELETE' }));
                        }
                      }}
                    >
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
