import { useTranslation } from 'react-i18next';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? 'en';
  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm" role="group" aria-label="Language">
      {(['en', 'de'] as const).map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => void i18n.changeLanguage(lng)}
          className={
            current === lng
              ? 'px-3 py-1 bg-indigo-600 text-white font-medium'
              : 'px-3 py-1 bg-white text-gray-600 hover:bg-gray-50'
          }
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
