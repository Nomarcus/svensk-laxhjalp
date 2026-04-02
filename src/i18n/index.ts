import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sv from './locales/sv.json';

const savedLanguage = localStorage.getItem('app-language') || 'sv';

export const LANGUAGES = [
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];

const RTL_LANGUAGES = new Set(['ar']);

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.has(lang);
}

export function setDocumentDirection(lang: string) {
  const dir = isRTL(lang) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

i18n
  .use(initReactI18next)
  .init({
    resources: { sv: { translation: sv } },
    lng: savedLanguage,
    fallbackLng: 'sv',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

/** Load locale JSON into i18n before switching language (avoids UI stuck on Swedish until next interaction). */
export async function ensureTranslationLoaded(lang: string): Promise<void> {
  if (lang === 'sv') return;
  try {
    const module = await import(`./locales/${lang}.json`);
    i18n.addResourceBundle(lang, 'translation', module.default, true, true);
  } catch {
    console.warn(`Translation for ${lang} not found, falling back to sv`);
  }
}

async function loadTranslation(lang: string) {
  await ensureTranslationLoaded(lang);
}

// Load saved language on startup
if (savedLanguage !== 'sv') {
  loadTranslation(savedLanguage);
}

// Set initial direction
setDocumentDirection(savedLanguage);

i18n.on('languageChanged', (lang) => {
  localStorage.setItem('app-language', lang);
  setDocumentDirection(lang);
  loadTranslation(lang);
});

export default i18n;
