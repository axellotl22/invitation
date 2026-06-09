import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api';
import { ErrorNote } from '../ErrorNote';
import type { DuplicateHousehold, DuplicatePair, InvitationDetail } from '../../types';

export function DuplicatesTab({ invitation, reload }: { invitation: InvitationDetail; reload: () => void }) {
  const { t } = useTranslation();
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    api<DuplicatePair[]>(`/api/invitations/${invitation.id}/duplicates`)
      .then(setPairs)
      .catch((err) => setError(err instanceof ApiError ? err.key : 'errors.server'));
  }
  useEffect(load, [invitation.id]);

  async function resolve(body: Record<string, string>) {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/invitations/${invitation.id}/duplicates/resolve`, { method: 'POST', body });
      load();
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
    }
  }

  if (pairs === null && !error) return <p className="text-gray-500">{t('common.loading')}</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="font-semibold">{t('duplicates.title')}</h2>
      <ErrorNote errorKey={error} />
      {pairs && pairs.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">{t('duplicates.empty')}</div>
      ) : (
        pairs?.map((pair) => (
          <div key={`${pair.a.id}:${pair.b.id}`} className="card p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {pair.reasons.map((reason) => (
                <span key={reason} className="text-xs bg-amber-50 text-amber-800 rounded-full px-2 py-0.5">
                  {t(reason)}
                </span>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {[pair.a, pair.b].map((household) => (
                <HouseholdCard
                  key={household.id}
                  household={household}
                  busy={busy}
                  onKeep={() =>
                    void resolve({
                      action: 'merge',
                      winnerId: household.id,
                      loserId: household.id === pair.a.id ? pair.b.id : pair.a.id,
                    })
                  }
                  onDelete={() => {
                    if (window.confirm(t('common.confirmDelete'))) {
                      void resolve({ action: 'delete', householdId: household.id });
                    }
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{t('duplicates.mergeHint')}</p>
              <button
                type="button"
                disabled={busy}
                className="btn-secondary"
                onClick={() => void resolve({ action: 'keep', aId: pair.a.id, bId: pair.b.id })}
              >
                {t('duplicates.keepBoth')}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function HouseholdCard({
  household,
  busy,
  onKeep,
  onDelete,
}: {
  household: DuplicateHousehold;
  busy: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{household.name}</p>
        {household.rsvpStatus === 'RESPONDED' && (
          <span className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 whitespace-nowrap">
            {t('duplicates.respondedBadge')}
          </span>
        )}
      </div>
      {household.email && <p className="text-xs text-gray-500">{household.email}</p>}
      <p className="text-sm text-gray-600">{household.members.map((m) => m.name).join(', ')}</p>
      <div className="flex gap-2 pt-1">
        <button type="button" disabled={busy} className="btn-secondary text-xs px-2 py-1" onClick={onKeep}>
          {t('duplicates.keepThis')}
        </button>
        <button type="button" disabled={busy} className="btn-danger text-xs px-2 py-1" onClick={onDelete}>
          {t('duplicates.deleteThis')}
        </button>
      </div>
    </div>
  );
}
