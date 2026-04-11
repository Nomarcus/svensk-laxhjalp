import { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Download, X, Share, MoreVertical, Plus, ExternalLink, Monitor, ChevronDown } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';
type DesktopBrowser = 'edge' | 'chrome' | 'safari' | 'firefox' | 'other';

function isIOSDevice(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return true;
  // iPadOS 13+ reporting as Mac with touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}

function isAndroidDevice(): boolean {
  return /android/.test(navigator.userAgent.toLowerCase());
}

function detectPlatform(): Platform {
  if (isIOSDevice()) return 'ios';
  if (isAndroidDevice()) return 'android';
  return 'desktop';
}

/** Edge must be detected before Chrome (Edge UA contains Chrome). */
function detectDesktopBrowser(): DesktopBrowser {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'edge';
  if (/OPR\//.test(ua) || /Opera\//.test(ua)) return 'chrome';
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'chrome';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'safari';
  return 'other';
}

function isInStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function InstallRichText({
  i18nKey,
  className = '',
}: {
  i18nKey: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`[&_strong]:font-semibold [&_strong]:text-stone-900 dark:[&_strong]:text-stone-100 ${className}`}
    >
      <Trans i18nKey={i18nKey} t={t} components={{ strong: <strong /> }} />
    </span>
  );
}

// Auto-popup banner (Chromium browsers with beforeinstallprompt)
export default function InstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsStandalone(true);
      return;
    }
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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 p-4 z-40 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Download size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">{t('install.installBanner')}</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{t('install.installBannerDesc')}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              type="button"
              onClick={handleInstall}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all"
            >
              {t('install.install')}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 text-stone-500 dark:text-stone-400 text-xs hover:text-stone-700 dark:hover:text-stone-200 transition-all"
            >
              {t('install.notNow')}
            </button>
          </div>
        </div>
        <button type="button" onClick={handleDismiss} className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function StepRow({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <div className="flex-1 text-sm text-stone-700 dark:text-stone-200 leading-relaxed flex items-start gap-2 min-w-0">
        {icon && <span className="text-stone-400 dark:text-stone-500 mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function BrowserCard({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-stone-200 dark:border-stone-600 bg-stone-50/80 dark:bg-slate-800/60 overflow-hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100/80 dark:hover:bg-slate-800 select-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-0 space-y-3 border-t border-stone-200/80 dark:border-stone-600/80">
        {children}
      </div>
    </details>
  );
}

function DesktopBrowserInstructions({ primary }: { primary: DesktopBrowser }) {
  const { t } = useTranslation();

  const chromeEdgeFallback = (
    <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 p-3 bg-white/70 dark:bg-slate-900/40 rounded-xl border border-stone-100 dark:border-stone-700">
      <InstallRichText i18nKey="install.desktopFallback" />
    </p>
  );

  const ordered: DesktopBrowser[] = ['edge', 'chrome', 'safari', 'firefox', 'other'];
  const rest = ordered.filter((b) => b !== primary);

  const Block = ({ browser, expanded }: { browser: DesktopBrowser; expanded: boolean }) => {
    if (browser === 'firefox') {
      return (
        <BrowserCard title={t('install.firefoxLabel')} defaultOpen={expanded}>
          <p className="text-sm text-stone-600 dark:text-stone-300 pt-3">
            <InstallRichText i18nKey="install.firefoxNote" />
          </p>
        </BrowserCard>
      );
    }
    if (browser === 'safari') {
      return (
        <BrowserCard title={t('install.safariLabel')} defaultOpen={expanded}>
          <div className="space-y-3 pt-3">
            <StepRow n={1} icon={<Share size={16} />}>
              <InstallRichText i18nKey="install.safariStep1" />
            </StepRow>
            <StepRow n={2}>
              <InstallRichText i18nKey="install.safariStep2" />
            </StepRow>
          </div>
        </BrowserCard>
      );
    }
    if (browser === 'edge') {
      return (
        <BrowserCard title={t('install.edgeLabel')} defaultOpen={expanded}>
          <div className="space-y-3 pt-3">
            <StepRow n={1} icon={<Monitor size={16} />}>
              <InstallRichText i18nKey="install.edgeStep1" />
            </StepRow>
            <StepRow n={2} icon={<Download size={16} />}>
              <InstallRichText i18nKey="install.edgeStep2" />
            </StepRow>
            {chromeEdgeFallback}
          </div>
        </BrowserCard>
      );
    }
    if (browser === 'chrome') {
      return (
        <BrowserCard title={t('install.chromeLabel')} defaultOpen={expanded}>
          <div className="space-y-3 pt-3">
            <StepRow n={1} icon={<Download size={16} />}>
              <InstallRichText i18nKey="install.chromeStep1" />
            </StepRow>
            <StepRow n={2}>
              <InstallRichText i18nKey="install.chromeStep2" />
            </StepRow>
            {chromeEdgeFallback}
          </div>
        </BrowserCard>
      );
    }
    // other
    return (
      <BrowserCard title={t('install.otherBrowsersLabel')} defaultOpen={expanded}>
        <div className="space-y-3 pt-3">
          <StepRow n={1}>
            <InstallRichText i18nKey="install.unknownStep1" />
          </StepRow>
          <StepRow n={2}>
            <InstallRichText i18nKey="install.unknownStep2" />
          </StepRow>
          <StepRow n={3}>
            <InstallRichText i18nKey="install.unknownStep3" />
          </StepRow>
        </div>
      </BrowserCard>
    );
  };

  return (
    <div className="space-y-3">
      <Block browser={primary} expanded />
      {rest.map((b) => (
        <Block key={b} browser={b} expanded={false} />
      ))}
    </div>
  );
}

// Full install guide modal
export function InstallGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const platform = detectPlatform();
  const desktopBrowser = detectDesktopBrowser();
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-black/5 dark:border-white/10 p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-4">
            <Download size={28} />
          </div>
          <h2 className="text-xl font-serif italic mb-2 dark:text-stone-100">{t('install.alreadyInstalled')}</h2>
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-6">{t('install.alreadyInstalledDesc')}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700 transition-all"
          >
            {t('install.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-black/5 dark:border-white/10 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 pb-4 sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-serif italic dark:text-stone-100">{t('nav.installApp')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-full text-stone-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-3 leading-relaxed">
            {t('install.modalSubtitle')}
          </p>
          {nativePrompt && (
            <button
              type="button"
              onClick={handleNativeInstall}
              className="mt-4 w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {t('install.installDirect')}
            </button>
          )}
          {nativePrompt && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 text-center">
              {t('install.afterNativeHint')}
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-6">
          {platform === 'ios' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{t('install.followStepsInSafari')}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                <InstallRichText i18nKey="install.iosIntro" />
              </p>
              <StepRow n={1} icon={<Share size={16} />}>
                <InstallRichText i18nKey="install.iosTapShare" />
              </StepRow>
              <StepRow n={2} icon={<Plus size={16} />}>
                <InstallRichText i18nKey="install.iosAddHome" />
              </StepRow>
              <StepRow n={3}>
                <InstallRichText i18nKey="install.iosConfirm" />
              </StepRow>
              <p className="text-xs text-stone-600 dark:text-stone-300 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl leading-relaxed">
                <InstallRichText i18nKey="install.iosSafariTip" />
              </p>
            </div>
          )}

          {platform === 'android' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{t('install.androidHeading')}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                <InstallRichText i18nKey="install.androidIntro" />
              </p>
              <StepRow n={1} icon={<MoreVertical size={16} />}>
                <InstallRichText i18nKey="install.androidMenu" />
              </StepRow>
              <StepRow n={2}>
                <InstallRichText i18nKey="install.androidAdd" />
              </StepRow>
              <StepRow n={3}>
                <InstallRichText i18nKey="install.androidConfirm" />
              </StepRow>
              <p className="text-xs text-stone-500 dark:text-stone-400 p-3 bg-stone-50 dark:bg-slate-800/60 rounded-xl leading-relaxed">
                <InstallRichText i18nKey="install.androidSamsungHint" />
              </p>
            </div>
          )}

          {platform === 'desktop' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{t('install.desktopHeading')}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                {nativePrompt ? t('install.desktopWithButtonIntro') : t('install.desktopNoButtonIntro')}
              </p>
              <DesktopBrowserInstructions primary={desktopBrowser} />
              <p className="text-xs text-stone-500 dark:text-stone-400 p-3 bg-stone-50 dark:bg-slate-800/60 rounded-xl leading-relaxed">
                <InstallRichText i18nKey="install.desktopNote" />
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-start gap-2 text-xs text-stone-400 dark:text-stone-500">
            <ExternalLink size={12} className="shrink-0 mt-0.5" />
            <span>{t('install.offlineNote')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
