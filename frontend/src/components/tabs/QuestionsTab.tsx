import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api';
import { ErrorNote } from '../ErrorNote';
import type { InvitationDetail, Question, QuestionScope, QuestionType } from '../../types';

interface QuestionDraft {
  id?: string;
  type: QuestionType;
  scope: QuestionScope;
  required: boolean;
  labelEn: string;
  labelDe: string;
  optionsEn: string; // newline-separated in the editor
  optionsDe: string;
}

const EMPTY: QuestionDraft = {
  type: 'TEXT',
  scope: 'PER_HOUSEHOLD',
  required: false,
  labelEn: '',
  labelDe: '',
  optionsEn: '',
  optionsDe: '',
};

function toDraft(q: Question): QuestionDraft {
  return {
    id: q.id,
    type: q.type,
    scope: q.scope,
    required: q.required,
    labelEn: q.labelEn,
    labelDe: q.labelDe,
    optionsEn: (JSON.parse(q.optionsEn) as string[]).join('\n'),
    optionsDe: (JSON.parse(q.optionsDe) as string[]).join('\n'),
  };
}

export function QuestionsTab({ invitation, reload }: { invitation: InvitationDetail; reload: () => void }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lang = i18n.resolvedLanguage === 'de' ? 'de' : 'en';
  const isChoice = draft && (draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTI_CHOICE');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setBusy(true);
    const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
    const body = {
      type: draft.type,
      scope: draft.scope,
      required: draft.required,
      labelEn: draft.labelEn,
      labelDe: draft.labelDe,
      optionsEn: lines(draft.optionsEn),
      optionsDe: lines(draft.optionsDe),
      sortOrder: draft.id
        ? invitation.questions.find((q) => q.id === draft.id)?.sortOrder ?? 0
        : invitation.questions.length,
    };
    try {
      if (draft.id) await api(`/api/questions/${draft.id}`, { method: 'PATCH', body });
      else await api(`/api/invitations/${invitation.id}/questions`, { method: 'POST', body });
      setDraft(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await api(`/api/questions/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('questions.title')}</h2>
        <button type="button" className="btn-primary" onClick={() => setDraft({ ...EMPTY })}>
          + {t('questions.add')}
        </button>
      </div>
      <ErrorNote errorKey={error} />

      {draft && (
        <form onSubmit={(e) => void save(e)} className="card p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="q-type">
                {t('questions.type')}
              </label>
              <select
                id="q-type"
                className="input"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as QuestionType })}
              >
                {(['TEXT', 'YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE'] as const).map((type) => (
                  <option key={type} value={type}>
                    {t(`questions.type${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q-scope">
                {t('questions.scope')}
              </label>
              <select
                id="q-scope"
                className="input"
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value as QuestionScope })}
              >
                {(['PER_HOUSEHOLD', 'PER_MEMBER'] as const).map((scope) => (
                  <option key={scope} value={scope}>
                    {t(`questions.scope${scope}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q-label-de">
                {t('questions.labelDe')}
              </label>
              <input
                id="q-label-de"
                className="input"
                required
                value={draft.labelDe}
                onChange={(e) => setDraft({ ...draft, labelDe: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="q-label-en">
                {t('questions.labelEn')}
              </label>
              <input
                id="q-label-en"
                className="input"
                required
                value={draft.labelEn}
                onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })}
              />
            </div>
            {isChoice && (
              <>
                <div>
                  <label className="label" htmlFor="q-opt-de">
                    {t('questions.optionsDe')}
                  </label>
                  <textarea
                    id="q-opt-de"
                    className="input min-h-24"
                    required
                    value={draft.optionsDe}
                    onChange={(e) => setDraft({ ...draft, optionsDe: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="q-opt-en">
                    {t('questions.optionsEn')}
                  </label>
                  <textarea
                    id="q-opt-en"
                    className="input min-h-24"
                    required
                    value={draft.optionsEn}
                    onChange={(e) => setDraft({ ...draft, optionsEn: e.target.value })}
                  />
                </div>
                <p className="text-xs text-gray-500 sm:col-span-2">{t('questions.optionsHint')}</p>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
            />
            {t('questions.required')}
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {t('common.save')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {invitation.questions.length === 0 && !draft ? (
        <div className="card p-8 text-center text-gray-500">{t('questions.empty')}</div>
      ) : (
        <ul className="space-y-2">
          {invitation.questions.map((q) => (
            <li key={q.id} className="card p-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">{lang === 'de' ? q.labelDe : q.labelEn}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {t(`questions.type${q.type}`)} · {t(`questions.scope${q.scope}`)}
                  {q.required && <> · {t('questions.required')}</>}
                </p>
              </div>
              <div className="flex gap-3 whitespace-nowrap">
                <button type="button" className="text-sm text-indigo-600 hover:underline" onClick={() => setDraft(toDraft(q))}>
                  {t('common.edit')}
                </button>
                <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => void remove(q.id)}>
                  {t('common.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
