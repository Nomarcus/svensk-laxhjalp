import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Monitor, Globe, ChevronDown, ChevronUp, Share, MoreVertical, Plus } from 'lucide-react';
import { cn } from '../utils/cn';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android-chrome' | 'ios-safari' | 'ios-chrome' | 'desktop-chrome' | 'desktop-edge' | 'desktop-firefox' | 'mac-safari' | 'unknown';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMac = /macintosh|mac os/.test(ua) && !isIOS;
  const isChrome = /chrome/.test(ua) && !/edg/.test(ua);
  const isEdge = /edg/.test(ua);
  const isFirefox = /firefox/.test(ua);
  const isSafari = /safari/.test(ua) && !isChrome && !isEdge;

  if (isIOS && isSafari) return 'ios-safari';
  if (isIOS) return 'ios-chrome';
  if (isAndroid) return 'android-chrome';
  if (isMac && isSafari) return 'mac-safari';
  if (isEdge) return 'desktop-edge';
  if (isFirefox) return 'desktop-firefox';
  if (isChrome) return 'desktop-chrome';
  return 'unknown';
}

const INSTRUCTIONS: Record<string, { title: string; icon: React.ReactNode; steps: string[] }> = {
  'android-chrome': {
    title: 'Android (Chrome)',
    icon: <Smartphone size={18} />,
    steps: [
      'Tryck pa menyn (tre prickar uppe till hoger)',
      'Valj "Lagg till pa startskarm" eller "Installera app"',
      'Tryck "Installera" i dialogrutan',
      'Appen finns nu pa din hemskarm!',
    ],
  },
  'ios-safari': {
    title: 'iPhone / iPad (Safari)',
    icon: <Smartphone size={18} />,
    steps: [
      'Tryck pa Dela-knappen (fyrkant med pil upp) langst ner',
      'Scrolla ner och tryck "Lagg till pa hemskarm"',
      'Tryck "Lagg till" uppe till hoger',
      'Appen finns nu pa din hemskarm!',
    ],
  },
  'ios-chrome': {
    title: 'iPhone / iPad (Chrome)',
    icon: <Smartphone size={18} />,
    steps: [
      'Oppna denna sida i Safari istallet (Chrome pa iOS stoder ej installering)',
      'I Safari: tryck Dela-knappen (fyrkant med pil upp)',
      'Valj "Lagg till pa hemskarm"',
      'Tryck "Lagg till"',
    ],
  },
  'desktop-chrome': {
    title: 'Chrome (dator)',
    icon: <Monitor size={18} />,
    steps: [
      'Klicka pa installera-ikonen i adressfaltets hogra sida',
      'Eller: klicka pa menyn (tre prickar) och valj "Installera Svensk Laxhjalp..."',
      'Klicka "Installera" i dialogrutan',
      'Appen oppnas nu i ett eget fonster!',
    ],
  },
  'desktop-edge': {
    title: 'Microsoft Edge',
    icon: <Monitor size={18} />,
    steps: [
      'Klicka pa installera-ikonen i adressfaltet',
      'Eller: klicka pa menyn (...) och valj "Appar" → "Installera den har webbplatsen som en app"',
      'Klicka "Installera"',
      'Appen lags till i Startmenyn och oppnas i ett eget fonster!',
    ],
  },
  'desktop-firefox': {
    title: 'Firefox',
    icon: <Globe size={18} />,
    steps: [
      'Firefox stoder inte PWA-installation direkt',
      'Alternativ 1: Oppna sidan i Chrome eller Edge och installera darifrån',
      'Alternativ 2: Skapa ett bokmärke och lagg det pa skrivbordet',
      'Tips: I Chrome/Edge far du den basta app-upplevelsen!',
    ],
  },
  'mac-safari': {
    title: 'Mac (Safari)',
    icon: <Monitor size={18} />,
    steps: [
      'Klicka pa Dela-knappen i verktygsfältet',
      'Valj "Lagg till i Dock"',
      'Klicka "Lagg till"',
      'Appen finns nu i din Dock!',
    ],
  },
};

// Auto-popup banner
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

// Full install guide page/modal
export function InstallGuide({ onClose }: { onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
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

  // Auto-expand the detected platform
  useEffect(() => {
    if (platform !== 'unknown') {
      setExpanded(platform);
    }
  }, [platform]);

  const handleNativeInstall = async () => {
    if (!nativePrompt) return;
    await nativePrompt.prompt();
    const { outcome } = await nativePrompt.userChoice;
    if (outcome === 'accepted') {
      setNativePrompt(null);
      onClose();
    }
  };

  const platformOrder = [
    'android-chrome', 'ios-safari', 'ios-chrome',
    'desktop-chrome', 'desktop-edge', 'desktop-firefox', 'mac-safari'
  ];

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                <Download size={24} />
              </div>
              <div>
                <h2 className="text-xl font-serif italic">Installera appen</h2>
                <p className="text-sm text-stone-500">Få Läxhjälpen som en app på din enhet</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          {nativePrompt && (
            <button
              onClick={handleNativeInstall}
              className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Installera nu
            </button>
          )}
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs text-stone-400 uppercase tracking-widest font-bold px-2 mb-3">
            Välj din enhet
          </p>

          {platformOrder.map(key => {
            const info = INSTRUCTIONS[key];
            const isDetected = key === platform;
            const isOpen = expanded === key;

            return (
              <div key={key} className={cn(
                "rounded-2xl border transition-all",
                isDetected ? "border-emerald-200 bg-emerald-50/50" : "border-black/5 bg-white"
              )}>
                <button
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    isDetected ? "bg-emerald-100 text-emerald-600" : "bg-stone-100 text-stone-500"
                  )}>
                    {info.icon}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-stone-800">{info.title}</span>
                    {isDetected && (
                      <span className="ml-2 text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Din enhet
                      </span>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4">
                    <ol className="space-y-3 ml-4">
                      {info.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                            isDetected ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-600"
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-sm text-stone-600 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-black/5">
          <p className="text-[10px] text-center text-stone-400 uppercase tracking-widest">
            Appen fungerar offline och uppdateras automatiskt
          </p>
        </div>
      </div>
    </div>
  );
}
