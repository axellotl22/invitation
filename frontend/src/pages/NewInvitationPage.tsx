import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { Layout } from '../components/Layout';
import { InvitationForm, type InvitationFormValues } from '../components/InvitationForm';
import type { Invitation } from '../types';

export function NewInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function create(values: InvitationFormValues) {
    const invitation = await api<Invitation>('/api/invitations', { method: 'POST', body: values });
    navigate(`/dashboard/${invitation.id}`);
  }

  return (
    <Layout>
      <h1 className="text-2xl font-semibold mb-6">{t('editor.createTitle')}</h1>
      <div className="card p-6 max-w-2xl">
        <InvitationForm submitLabel={t('editor.create')} onSubmit={create} />
      </div>
    </Layout>
  );
}
