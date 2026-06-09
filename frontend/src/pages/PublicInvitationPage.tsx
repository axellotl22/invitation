import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api';
import { ErrorNote } from '../components/ErrorNote';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import type { PublicHouseholdData, PublicInvitation, PublicQuestion } from '../types';

type AnswerValue = string | number | number[];

function answerKey(questionId: string, memberId: string | null): string {
  return `${questionId}:${memberId ?? ''}`;
}

export function PublicInvitationPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(`hh-token-${slug}`));
  const [data, setData] = useState<PublicHouseholdData | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api<PublicInvitation>(`/api/i/${slug}`)
      .then((inv) => {
        setInvitation(inv);
        // First visit without an explicit language choice: use the invitation's default
        const params = new URLSearchParams(window.location.search);
        if (!params.get('lang') && !localStorage.getItem('i18nextLng')) {
          void i18n.changeLanguage(inv.defaultLocale);
        }
      })
      .catch(() => setNotFound(true));
  }, [slug, i18n]);

  const clearToken = useCallback(() => {
    sessionStorage.removeItem(`hh-token-${slug}`);
    setToken(null);
    setData(null);
  }, [slug]);

  useEffect(() => {
    if (!slug || !token) return;
    api<PublicHouseholdData>(`/api/i/${slug}/household`, { householdToken: token })
      .then(setData)
      .catch(() => clearToken());
  }, [slug, token, clearToken]);

  const lang = i18n.resolvedLanguage === 'de' ? 'de' : 'en';
  const dateFmt = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'full', timeStyle: 'short' });

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('public.notFound')}</p>
      </div>
    );
  }
  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="card overflow-hidden">
          {invitation.imageUrl && <img src={invitation.imageUrl} alt="" className="w-full max-h-80 object-cover" />}
          <div className="p-6 space-y-4">
            <h1 className="text-3xl font-semibold">{invitation.title}</h1>
            {invitation.description && <p className="text-gray-700 whitespace-pre-wrap">{invitation.description}</p>}
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-gray-500 w-16">{t('public.when')}</dt>
                <dd>{dateFmt.format(new Date(invitation.startsAt))}</dd>
              </div>
              {invitation.location && (
                <div className="flex gap-2">
                  <dt className="font-medium text-gray-500 w-16">{t('public.where')}</dt>
                  <dd>{invitation.location}</dd>
                </div>
              )}
              {invitation.rsvpDeadline && (
                <div className="flex gap-2">
                  <dt className="font-medium text-gray-500 w-16">{t('public.rsvpBy')}</dt>
                  <dd>{dateFmt.format(new Date(invitation.rsvpDeadline))}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {invitation.rsvpClosed ? (
          <div className="card p-6 text-center text-gray-600">{t('public.closed')}</div>
        ) : submitted ? (
          <div className="card p-8 text-center space-y-3">
            <h2 className="text-2xl font-semibold text-emerald-700">{t('public.thanksTitle')}</h2>
            <p className="text-gray-600">{t('public.thanksBody')}</p>
            <button type="button" className="btn-secondary" onClick={() => setSubmitted(false)}>
              {t('public.editAgain')}
            </button>
          </div>
        ) : !token || !data ? (
          <PinForm
            slug={slug!}
            onToken={(newToken) => {
              sessionStorage.setItem(`hh-token-${slug}`, newToken);
              setToken(newToken);
            }}
          />
        ) : (
          <RsvpForm
            slug={slug!}
            token={token}
            data={data}
            lang={lang}
            onExpired={clearToken}
            onDone={() => setSubmitted(true)}
          />
        )}
      </div>
    </div>
  );
}

function PinForm({ slug, onToken }: { slug: string; onToken: (token: string) => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await api<{ token: string }>(`/api/i/${slug}/pin`, { method: 'POST', body: { pin } });
      onToken(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t('public.pinTitle')}</h2>
        <p className="text-sm text-gray-500 mt-1">{t('public.pinHelp')}</p>
      </div>
      <input
        className="input text-center text-2xl tracking-[0.5em] max-w-56"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
      />
      <ErrorNote errorKey={error} />
      <button type="submit" disabled={busy || pin.length !== 6} className="btn-primary">
        {t('public.pinSubmit')}
      </button>
    </form>
  );
}

function RsvpForm({
  slug,
  token,
  data,
  lang,
  onExpired,
  onDone,
}: {
  slug: string;
  token: string;
  data: PublicHouseholdData;
  lang: 'en' | 'de';
  onExpired: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { household, questions } = data;
  const [attendance, setAttendance] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(household.members.map((m) => [m.id, m.attending])),
  );
  const [message, setMessage] = useState(household.message ?? '');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    const initial: Record<string, AnswerValue> = {};
    for (const a of household.answers) {
      initial[answerKey(a.questionId, a.memberId)] = a.value as AnswerValue;
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attendingMembers = household.members.filter((m) => attendance[m.id] === true);
  const householdQuestions = questions.filter((q) => q.scope === 'PER_HOUSEHOLD');
  const memberQuestions = questions.filter((q) => q.scope === 'PER_MEMBER');

  function setAnswer(questionId: string, memberId: string | null, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [answerKey(questionId, memberId)]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (household.members.some((m) => attendance[m.id] === null || attendance[m.id] === undefined)) {
      setError('errors.validation');
      return;
    }
    setError(null);
    setBusy(true);
    const answerList: { questionId: string; memberId?: string | null; value: unknown }[] = [];
    for (const q of householdQuestions) {
      const value = answers[answerKey(q.id, null)];
      if (value !== undefined) answerList.push({ questionId: q.id, value });
    }
    for (const q of memberQuestions) {
      for (const m of attendingMembers) {
        const value = answers[answerKey(q.id, m.id)];
        if (value !== undefined) answerList.push({ questionId: q.id, memberId: m.id, value });
      }
    }
    try {
      await api(`/api/i/${slug}/rsvp`, {
        method: 'PUT',
        householdToken: token,
        body: {
          members: household.members.map((m) => ({ id: m.id, attending: attendance[m.id] === true })),
          message: message || null,
          answers: answerList,
        },
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onExpired();
        return;
      }
      setError(err instanceof ApiError ? err.key : 'errors.server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="card p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('public.hello', { name: household.name })}</h2>
        {household.rsvpStatus === 'RESPONDED' && <p className="text-sm text-amber-700 mt-1">{t('public.updateNote')}</p>}
      </div>

      <fieldset className="space-y-3">
        <legend className="font-medium">{t('public.whoAttends')}</legend>
        {household.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2">
            <span className="font-medium text-sm">{m.name}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAttendance({ ...attendance, [m.id]: true })}
                className={
                  attendance[m.id] === true
                    ? 'btn bg-emerald-600 text-white text-xs px-3 py-1'
                    : 'btn-secondary text-xs px-3 py-1'
                }
              >
                ✓ {t('public.memberYes')}
              </button>
              <button
                type="button"
                onClick={() => setAttendance({ ...attendance, [m.id]: false })}
                className={
                  attendance[m.id] === false
                    ? 'btn bg-rose-600 text-white text-xs px-3 py-1'
                    : 'btn-secondary text-xs px-3 py-1'
                }
              >
                ✗ {t('public.memberNo')}
              </button>
            </div>
          </div>
        ))}
      </fieldset>

      {(householdQuestions.length > 0 || (memberQuestions.length > 0 && attendingMembers.length > 0)) && (
        <div className="space-y-4">
          <h3 className="font-medium">{t('public.questionsTitle')}</h3>
          {householdQuestions.map((q) => (
            <QuestionInput
              key={q.id}
              question={q}
              lang={lang}
              value={answers[answerKey(q.id, null)]}
              onChange={(value) => setAnswer(q.id, null, value)}
            />
          ))}
          {memberQuestions.map((q) =>
            attendingMembers.map((m) => (
              <QuestionInput
                key={`${q.id}:${m.id}`}
                question={q}
                lang={lang}
                memberName={m.name}
                value={answers[answerKey(q.id, m.id)]}
                onChange={(value) => setAnswer(q.id, m.id, value)}
              />
            )),
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="rsvp-message">
          {t('public.message')} ({t('common.optional')})
        </label>
        <textarea
          id="rsvp-message"
          className="input min-h-20"
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <ErrorNote errorKey={error} />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {t('public.submit')}
      </button>
    </form>
  );
}

function QuestionInput({
  question,
  lang,
  memberName,
  value,
  onChange,
}: {
  question: PublicQuestion;
  lang: 'en' | 'de';
  memberName?: string;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const { t } = useTranslation();
  const label = lang === 'de' ? question.labelDe : question.labelEn;
  const options = lang === 'de' ? question.optionsDe : question.optionsEn;
  const name = `${question.id}-${memberName ?? 'hh'}`;

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <p className="text-sm font-medium">
        {label}
        {question.required && <span className="text-rose-600"> *</span>}
        {memberName && <span className="block text-xs text-gray-500 font-normal">{t('public.forMember', { name: memberName })}</span>}
      </p>
      {question.type === 'TEXT' && (
        <input
          className="input"
          required={question.required}
          maxLength={2000}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {question.type === 'YES_NO' && (
        <div className="flex gap-4">
          {(['yes', 'no'] as const).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                required={question.required}
                checked={value === opt}
                onChange={() => onChange(opt)}
              />
              {opt === 'yes' ? t('common.yes') : t('common.no')}
            </label>
          ))}
        </div>
      )}
      {question.type === 'SINGLE_CHOICE' && (
        <div className="space-y-1">
          {options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={name}
                required={question.required}
                checked={value === i}
                onChange={() => onChange(i)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {question.type === 'MULTI_CHOICE' && (
        <div className="space-y-1">
          {options.map((opt, i) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <label key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(i)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...selected, i] : selected.filter((v) => v !== i))
                  }
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
