import { useState, useEffect } from 'react';
import { Download, X, Share, MoreVertical, Plus, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'desktop' | 'unknown';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function isInStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

// Auto-popup banner
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) { setIsStandalone(true); return; }
    if (localStorage.getItem('pwa-install-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || !deferredPrompt || dismissed) return null;

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

// Full install guide modal
export function InstallGuide({ onClose }: { onClose: () => void }) {
  const platform = detectPlatform();
  const [nativePrompt, setNativePrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setNativePrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleNativeInstall = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const { outcome } = await nativePrompt.userChoice;
    if (outcome === 'accepted') {
      setNativePrompt(null);
      onClose();
    }
  };

  if (isInStandaloneMode()) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <Download size={28} />
          </div>
          <h2 className="text-xl font-serif italic mb-2">Redan installerad!</h2>
          <p className="text-stone-500 text-sm mb-6">Du kör redan Läxhjälpen som app.</p>
          <button onClick={onClose} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all">
            Stäng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-serif italic">Installera appen</h2>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Native install button (Chrome/Edge on Android & Desktop) */}
          {nativePrompt && (
            <button
              onClick={handleNativeInstall}
              className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 mb-4"
            >
              <Download size={18} />
              Installera direkt
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="px-6 pb-6">
          {platform === 'ios' && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500 mb-2">Följ dessa steg i Safari:</p>
              <Step n={1} icon={<Share size={16} />}>
                Tryck på <strong>Dela-knappen</strong> längst ner (fyrkant med pil upp)
              </Step>
              <Step n={2} icon={<Plus size={16} />}>
                Scrolla ner och tryck <strong>Lägg till på hemskärm</strong>
              </Step>
              <Step n={3}>
                Tryck <strong>Lägg till</strong> uppe till höger
              </Step>
              <p className="text-xs text-stone-400 mt-4 p-3 bg-stone-50 rounded-xl">
                Använder du Chrome på iPhone? Öppna <strong>foraldrahjalpen.se</strong> i Safari — bara Safari kan installera appar på iOS.
              </p>
            </div>
          )}

          {platform === 'android' && !nativePrompt && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500 mb-2">Följ dessa steg:</p>
              <Step n={1} icon={<MoreVertical size={16} />}>
                Tryck på <strong>menyn</strong> (tre prickar uppe till höger)
              </Step>
              <Step n={2}>
                Välj <strong>Lägg till på startskärm</strong> eller <strong>Installera app</strong>
              </Step>
              <Step n={3}>
                Tryck <strong>Installera</strong> i dialogrutan
              </Step>
            </div>
          )}

          {platform === 'desktop' && !nativePrompt && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500 mb-2">Följ dessa steg:</p>
              <Step n={1} icon={<Download size={16} />}>
                Klicka på <strong>installera-ikonen</strong> i adressfältet (till höger)
              </Step>
              <Step n={2}>
                Klicka <strong>Installera</strong> i dialogrutan som visas
              </Step>
              <p className="text-xs text-stone-400 mt-4 p-3 bg-stone-50 rounded-xl">
                Ingen installera-ikon? Klicka på menyn och välj <strong>Installera Läxhjälpen</strong>. Fungerar i Chrome, Edge och Safari.
              </p>
            </div>
          )}

          {platform === 'unknown' && !nativePrompt && (
            <div className="space-y-4">
              <p className="text-sm text-stone-500 mb-2">Öppna sidan i Chrome, Edge eller Safari och följ dessa steg:</p>
              <Step n={1}>
                Öppna webbläsarens meny
              </Step>
              <Step n={2}>
                Välj <strong>Installera</strong> eller <strong>Lägg till på hemskärm</strong>
              </Step>
              <Step n={3}>
                Bekräfta installationen
              </Step>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 border-t border-black/5">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <ExternalLink size={12} />
            <span>Appen fungerar offline och uppdateras automatiskt</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 text-sm text-stone-700 leading-relaxed flex items-start gap-2">
        {icon && <span className="text-stone-400 mt-0.5 shrink-0">{icon}</span>}
        <span>{children}</span>
      </div>
    </div>
  );
}
