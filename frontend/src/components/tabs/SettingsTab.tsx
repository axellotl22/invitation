import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api';
import { InvitationForm, type InvitationFormValues } from '../InvitationForm';
import type { InvitationDetail } from '../../types';

export function SettingsTab({ invitation, reload }: { invitation: InvitationDetail; reload: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function save(values: InvitationFormValues) {
    await api(`/api/invitations/${invitation.id}`, { method: 'PATCH', body: values });
    reload();
  }

  async function toggleOpen() {
    await api(`/api/invitations/${invitation.id}`, { method: 'PATCH', body: { isOpen: !invitation.isOpen } });
    reload();
  }

  async function remove() {
    if (!window.confirm(t('common.confirmDelete'))) return;
    await api(`/api/invitations/${invitation.id}`, { method: 'DELETE' });
    navigate('/dashboard');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="card p-4 flex items-center justify-between">
        <span className="text-sm font-medium">
          {invitation.isOpen ? t('editor.rsvpOpen') : t('editor.rsvpClosedToggle')}
        </span>
        <button
          type="button"
          onClick={() => void toggleOpen()}
          className={invitation.isOpen ? 'btn-danger' : 'btn-primary'}
        >
          {invitation.isOpen ? t('editor.rsvpClosedToggle') : t('editor.rsvpOpen')}
        </button>
      </div>
      <div className="card p-6">
        <h2 className="font-semibold mb-4">{t('editor.settingsTitle')}</h2>
        <InvitationForm initial={invitation} submitLabel={t('common.save')} onSubmit={save} />
      </div>
      <div className="card p-4 border-red-200 flex items-center justify-between">
        <span className="text-sm text-red-700 font-medium">{t('editor.deleteInvitation')}</span>
        <button type="button" className="btn-danger" onClick={() => void remove()}>
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
}
