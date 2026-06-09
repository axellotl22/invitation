import { useTranslation } from 'react-i18next';

/** Renders a backend error key (or null) as a translated message. */
export function ErrorNote({ errorKey }: { errorKey: string | null }) {
  const { t } = useTranslation();
  if (!errorKey) return null;
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
      {t(errorKey, { defaultValue: t('errors.server') })}
    </div>
  );
}
