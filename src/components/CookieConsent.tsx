import { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const COOKIE_CONSENT_KEY = 'cookie-consent-accepted';

export default function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!accepted) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg border border-black/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-emerald-50 rounded-xl shrink-0">
            <Shield size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-stone-700 font-medium mb-1">{t('cookie.title')}</p>
            <p className="text-xs text-stone-500 leading-relaxed">
              {t('cookie.description')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={accept}
            className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-all active:scale-[0.98]"
          >
            {t('cookie.accept')}
          </button>
          <button
            onClick={accept}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all"
            title={t('cookie.close')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
