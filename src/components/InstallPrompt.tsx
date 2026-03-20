import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white rounded-2xl shadow-xl border border-black/5 p-4 z-40 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
          <Download size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-stone-900">Installera Läxhjälpen</h3>
          <p className="text-xs text-stone-500 mt-0.5">Lägg till appen på din hemskärm för snabb åtkomst.</p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all"
            >
              Installera
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-stone-500 text-xs hover:text-stone-700 transition-all"
            >
              Inte nu
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 text-stone-400 hover:text-stone-600">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
