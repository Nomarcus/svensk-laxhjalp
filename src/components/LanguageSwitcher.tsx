import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';
import { cn } from '../utils/cn';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export default function LanguageSwitcher({ compact }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  if (compact) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
        >
          <Globe size={18} />
          <span className="text-sm">{currentLang.flag} {currentLang.name}</span>
        </button>
        {open && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 z-30 py-1 animate-in fade-in slide-in-from-bottom-2">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left",
                  lang.code === i18n.language
                    ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium"
                    : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-700"
                )}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full version for auth page
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur-sm border border-black/5 rounded-full text-sm text-stone-600 hover:bg-white hover:border-stone-300 transition-all shadow-sm"
      >
        <Globe size={16} className="text-stone-400" />
        <span>{currentLang.flag} {currentLang.name}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-black/5 z-30 py-1 animate-in fade-in slide-in-from-top-2">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                lang.code === i18n.language
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
