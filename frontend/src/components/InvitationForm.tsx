import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, uploadImage } from '../api';
import { ErrorNote } from './ErrorNote';
import type { Invitation } from '../types';

export interface InvitationFormValues {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string; // ISO
  rsvpDeadline: string | null;
  imageUrl: string | null;
  defaultLocale: string;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InvitationForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Invitation;
  submitLabel: string;
  onSubmit: (values: InvitationFormValues) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(initial?.startsAt ?? null));
  const [rsvpDeadline, setRsvpDeadline] = useState(toLocalInput(initial?.rsvpDeadline ?? null));
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [defaultLocale, setDefaultLocale] = useState(initial?.defaultLocale ?? 'de');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const { url } = await uploadImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        title,
        description: description || null,
        location: location || null,
        startsAt: new Date(startsAt).toISOString(),
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline).toISOString() : null,
        imageUrl,
        defaultLocale,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <div>
        <label className="label" htmlFor="inv-title">
          {t('editor.title')}
        </label>
        <input id="inv-title" className="input" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="inv-desc">
          {t('editor.description')} ({t('common.optional')})
        </label>
        <textarea
          id="inv-desc"
          className="input min-h-28"
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="inv-location">
            {t('editor.location')} ({t('common.optional')})
          </label>
          <input id="inv-location" className="input" maxLength={300} value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="inv-locale">
            {t('editor.defaultLocale')}
          </label>
          <select id="inv-locale" className="input" value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="inv-starts">
            {t('editor.startsAt')}
          </label>
          <input
            id="inv-starts"
            type="datetime-local"
            required
            className="input"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="inv-deadline">
            {t('editor.rsvpDeadline')} ({t('common.optional')})
          </label>
          <input
            id="inv-deadline"
            type="datetime-local"
            className="input"
            value={rsvpDeadline}
            onChange={(e) => setRsvpDeadline(e.target.value)}
          />
        </div>
      </div>
      <div>
        <span className="label">{t('editor.image')}</span>
        {imageUrl ? (
          <div className="space-y-2">
            <img src={imageUrl} alt="" className="max-h-48 rounded-lg border border-gray-200" />
            <button type="button" className="btn-secondary" onClick={() => setImageUrl(null)}>
              {t('editor.removeImage')}
            </button>
          </div>
        ) : (
          <label className="btn-secondary cursor-pointer">
            {t('editor.uploadImage')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void handleImage(e)} />
          </label>
        )}
      </div>
      <ErrorNote errorKey={error} />
      <button type="submit" disabled={busy} className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
