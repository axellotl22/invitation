import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { OverviewTab } from '../components/tabs/OverviewTab';
import { GuestsTab } from '../components/tabs/GuestsTab';
import { QuestionsTab } from '../components/tabs/QuestionsTab';
import { DuplicatesTab } from '../components/tabs/DuplicatesTab';
import { SettingsTab } from '../components/tabs/SettingsTab';
import type { InvitationDetail } from '../types';

const TABS = ['overview', 'guests', 'questions', 'duplicates', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function InvitationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (TABS as readonly string[]).includes(searchParams.get('tab') ?? '')
    ? (searchParams.get('tab') as Tab)
    : 'overview';
  const [invitation, setInvitation] = useState<InvitationDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    api<InvitationDetail>(`/api/invitations/${id}`)
      .then(setInvitation)
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(reload, [reload]);

  if (notFound) {
    return (
      <Layout>
        <p className="text-gray-500">{t('errors.notFound')}</p>
      </Layout>
    );
  }
  if (!invitation) {
    return (
      <Layout>
        <p className="text-gray-500">{t('common.loading')}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-indigo-600 hover:underline">
          ← {t('common.back')}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">{invitation.title}</h1>
      </div>
      <nav className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setSearchParams({ tab: name })}
            className={
              tab === name
                ? 'px-4 py-2 text-sm font-medium text-indigo-700 border-b-2 border-indigo-600 whitespace-nowrap'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-800 whitespace-nowrap'
            }
          >
            {t(`tabs.${name}`)}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <OverviewTab invitation={invitation} />}
      {tab === 'guests' && <GuestsTab invitation={invitation} reload={reload} />}
      {tab === 'questions' && <QuestionsTab invitation={invitation} reload={reload} />}
      {tab === 'duplicates' && <DuplicatesTab invitation={invitation} reload={reload} />}
      {tab === 'settings' && <SettingsTab invitation={invitation} reload={reload} />}
    </Layout>
  );
}
