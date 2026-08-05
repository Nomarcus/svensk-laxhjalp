import React from 'react';
import { LogOut, BookOpen, User as UserIcon, ChevronDown, Settings, Crown, Download, Users, X, Menu, Moon, Sun, Mail, Shield, FileText, Share2, BarChart3, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logout, User } from '../firebase';
import { cn } from '../utils/cn';
import type { AppTab, Child, SubscriptionTier } from '../types';
import { WORKSPACE_TEACHER_ID, isGeneralWorkspaceId } from '../constants/workspaces';
import { childDisplayName } from '../utils/childDisplay';
import LanguageSwitcher from './LanguageSwitcher';
import NavButton from './layout/NavButton';
import { NAV_ITEMS } from './layout/navItems';
import { useDialogA11y } from '../hooks/useDialogA11y';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  showAdminNav?: boolean;
  childrenList: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  onManageChildren: () => void;
  subscriptionTier?: SubscriptionTier;
  onShowInstallGuide?: () => void;
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
}

export default function Layout({
  children,
  user,
  activeTab,
  setActiveTab,
  childrenList,
  selectedChildId,
  onSelectChild,
  onManageChildren,
  subscriptionTier = 'free',
  onShowInstallGuide,
  onShowPrivacy,
  onShowTerms,
  dark,
  onToggleDark,
  showAdminNav = false,
}: LayoutProps) {
  const { t, i18n } = useTranslation();
  const [showChildSelect, setShowChildSelect] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const closeMobileMenu = React.useCallback(() => setShowMobileMenu(false), []);
  const mobileMenuRef = useDialogA11y<HTMLDivElement>(showMobileMenu, closeMobileMenu);
  const [shareNotice, setShareNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!shareNotice) return;
    const timer = window.setTimeout(() => setShareNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [shareNotice]);
  const selectedChild = childrenList.find(c => c.id === selectedChildId);
  const pickerChildren = childrenList.filter((c) => c.id !== WORKSPACE_TEACHER_ID);
  const hidePlannerNav = Boolean(selectedChildId && isGeneralWorkspaceId(selectedChildId));
  const isSharedChild = (child: Child) => child.ownerId !== user.uid;
  const hasSharing = (child: Child) => (child.sharedWith?.length || 0) > 0;
  const headerChildTitle =
    activeTab === 'teacher'
      ? t('workspace.teacherMode')
      : selectedChild
        ? childDisplayName(selectedChild, t)
        : t('child.select');
  const headerChildInitial = (headerChildTitle.trim()[0] || '?').toUpperCase();

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    setShowMobileMenu(false);
  };

  const handleShareApp = async () => {
    const shareData = {
      title: t('app.fullName'),
      text: t('library.shareText'),
      url: window.location.origin,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setShareNotice(t('library.copiedToClipboard'));
      }
    } catch (err) {
      console.error('Error sharing app:', err);
    }
  };

  return (
    <div className="h-dvh bg-[#F5F5F0] dark:bg-slate-950 flex flex-col md:flex-row font-sans text-stone-900 dark:text-stone-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-900 border-r border-black/5 dark:border-white/5 flex-col shrink-0">
        <div className="p-6 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="font-serif italic text-xl">{t('app.name')}</h1>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 uppercase tracking-widest font-medium">{t('app.subtitle')}</p>
        </div>

        {/* Child Selector */}
        <div className="px-4 py-6 border-b border-black/5 dark:border-white/5">
          <div className="relative">
            <button
              onClick={() => setShowChildSelect(!showChildSelect)}
              className="w-full flex items-center justify-between p-3 bg-stone-50 dark:bg-slate-800 rounded-2xl border border-black/5 dark:border-white/5 hover:bg-stone-100 dark:hover:bg-slate-700 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserIcon size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{t('child.label')}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">
                      {headerChildTitle}
                    </p>
                    {activeTab !== 'teacher' && selectedChild && (isSharedChild(selectedChild) || hasSharing(selectedChild)) && (
                      <Users size={12} className="text-blue-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} className={cn("text-stone-400 transition-transform", showChildSelect && "rotate-180")} />
            </button>

            {showChildSelect && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 z-20 py-2 animate-in fade-in slide-in-from-top-2">
                {pickerChildren.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      onSelectChild(child.id);
                      setShowChildSelect(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors text-left",
                      selectedChildId === child.id && activeTab !== 'teacher' && "text-emerald-600 dark:text-emerald-400 font-medium"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      selectedChildId === child.id && activeTab !== 'teacher' ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-stone-100 dark:bg-slate-700"
                    )}>
                      {(childDisplayName(child, t).trim()[0] || '?').toUpperCase()}
                    </div>
                    <span className="flex-1">{childDisplayName(child, t)}</span>
                    {isSharedChild(child) && (
                      <span className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{t('child.sharedWithYou')}</span>
                    )}
                    {!isSharedChild(child) && hasSharing(child) && (
                      <Users size={12} className="text-blue-400" />
                    )}
                  </button>
                ))}
                <div className="h-px bg-stone-100 dark:bg-slate-700 my-2 mx-4" />
                <button
                  onClick={() => {
                    onManageChildren();
                    setShowChildSelect(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-left text-sm"
                >
                  <Settings size={16} />
                  <span>{t('child.manage')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.filter((item) => item.id !== 'planner' || !hidePlannerNav).map((item) => (
            <NavButton
              key={item.id}
              variant="sidebar"
              layoutId="sidebar-active-pill"
              active={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              icon={<item.Icon size={20} />}
              label={t(item.labelKey)}
            />
          ))}
          <NavButton
            variant="sidebar"
            layoutId="sidebar-active-pill"
            active={activeTab === 'subscription'}
            onClick={() => setActiveTab('subscription')}
            icon={<Crown size={20} />}
            label={t('nav.subscription')}
            trailing={
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                subscriptionTier === 'free'
                  ? "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400"
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
              )}>
                {subscriptionTier === 'free' ? t('subscription.free') : t('subscription.memberBadge')}
              </span>
            }
          />
          <NavButton
            variant="sidebar"
            layoutId="sidebar-active-pill"
            active={activeTab === 'contact'}
            onClick={() => setActiveTab('contact')}
            icon={<Mail size={20} />}
            label={t('nav.contact')}
          />
          {showAdminNav && (
            <NavButton
              variant="sidebar"
              layoutId="sidebar-active-pill"
              tone="admin"
              active={activeTab === 'admin'}
              onClick={() => setActiveTab('admin')}
              icon={<BarChart3 size={20} />}
              label={t('nav.admin')}
            />
          )}
        </nav>

        <div className="p-4 border-t border-black/5 dark:border-white/5 mt-auto">
          <LanguageSwitcher compact />
          {/* Dark mode toggle */}
          {onToggleDark && (
            <button
              onClick={onToggleDark}
              className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-sm">{dark ? t('nav.lightMode') : t('nav.darkMode')}</span>
            </button>
          )}
          {onShowInstallGuide && (
            <button
              onClick={onShowInstallGuide}
              className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
            >
              <Download size={18} />
              <span className="text-sm">{t('nav.installApp')}</span>
            </button>
          )}
          <button
            onClick={handleShareApp}
            className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
          >
            <Share2 size={18} />
            <span className="text-sm">{t('nav.shareApp')}</span>
          </button>
          {onShowPrivacy && (
            <button
              onClick={onShowPrivacy}
              className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
            >
              <Shield size={18} />
              <span className="text-sm">{t('nav.gdpr')}</span>
            </button>
          )}
          {onShowTerms && (
            <button
              onClick={onShowTerms}
              className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 dark:text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
            >
              <FileText size={18} />
              <span className="text-sm">{t('nav.terms')}</span>
            </button>
          )}
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-stone-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <UserIcon size={16} className="text-stone-500 dark:text-stone-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName || t('common.user')}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header
        inert={showMobileMenu || undefined}
        className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/5 shrink-0 safe-area-top"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <BookOpen size={16} />
          </div>
          <span className="font-serif italic text-lg">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-2">
          {(selectedChild || activeTab === 'teacher') && (
            <button
              onClick={() => setShowMobileMenu(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 dark:bg-slate-800 rounded-full text-sm border border-black/5 dark:border-white/5"
            >
              <UserIcon size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium max-w-[100px] truncate">{headerChildTitle}</span>
            </button>
          )}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800"
            aria-label={t('nav.menu')}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main inert={showMobileMenu || undefined} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {i18n.language === 'ar' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm shrink-0">
            <span>⚠️</span>
            {t('language.betaNotice')}
          </div>
        )}
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        inert={showMobileMenu || undefined}
        className="md:hidden flex items-center bg-white dark:bg-slate-900 border-t border-black/5 dark:border-white/5 shrink-0 safe-area-bottom"
      >
        {NAV_ITEMS.filter((item) => item.inBottomBar && (item.id !== 'planner' || !hidePlannerNav)).map((item) => (
          <NavButton
            key={item.id}
            variant="bottom"
            active={activeTab === item.id}
            onClick={() => handleTabChange(item.id)}
            icon={<item.Icon size={20} />}
            label={t(item.shortLabelKey)}
          />
        ))}
        <NavButton
          variant="bottom"
          active={activeTab === 'info' || activeTab === 'subscription' || activeTab === 'contact' || activeTab === 'teacher'}
          onClick={() => setShowMobileMenu(true)}
          icon={<Menu size={20} />}
          label={t('nav.more')}
        />
      </nav>

      {/* Mobile Slide-in Menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div
            ref={mobileMenuRef}
            tabIndex={-1}
            className="relative ml-auto w-[300px] max-w-[85vw] self-stretch min-h-0 max-h-dvh bg-white dark:bg-slate-900 flex flex-col shadow-xl animate-in slide-in-from-right duration-200 outline-none"
          >
            <div className="flex shrink-0 items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
              <h2 id="mobile-menu-title" className="font-serif italic text-lg">{t('nav.menu')}</h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800"
                aria-label={t('common.close')}
              >
                <X size={20} className="text-stone-400" />
              </button>
            </div>

            {/* Scrollbar mittdel: iOS kräver min-h-0 + overflow-y-auto; fot med utloggning ligger fast under */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {/* Child Selector in mobile menu */}
              <div className="p-4 border-b border-black/5 dark:border-white/5">
                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-2">{t('child.label')}</p>
                <div className="space-y-1">
                  {pickerChildren.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => { onSelectChild(child.id); setShowMobileMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                        selectedChildId === child.id && activeTab !== 'teacher'
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium"
                          : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                        selectedChildId === child.id && activeTab !== 'teacher' ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200" : "bg-stone-100 dark:bg-slate-700 text-stone-500 dark:text-stone-400"
                      )}>
                        {(childDisplayName(child, t).trim()[0] || '?').toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm">{childDisplayName(child, t)}</span>
                      {isSharedChild(child) && (
                        <span className="text-[9px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{t('child.shared')}</span>
                      )}
                      {!isSharedChild(child) && hasSharing(child) && (
                        <Users size={12} className="text-blue-400" />
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => { onManageChildren(); setShowMobileMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all text-left text-sm"
                  >
                    <Settings size={16} />
                    <span>{t('child.manage')}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-1 pb-6">
              <NavButton
                variant="drawer"
                layoutId="drawer-active-pill"
                active={activeTab === 'info'}
                onClick={() => handleTabChange('info')}
                icon={<Info size={18} />}
                label={t('nav.info')}
              />
              <NavButton
                variant="drawer"
                layoutId="drawer-active-pill"
                active={activeTab === 'subscription'}
                onClick={() => handleTabChange('subscription')}
                icon={<Crown size={18} />}
                label={t('nav.subscription')}
                trailing={
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                    subscriptionTier === 'free'
                      ? "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  )}>
                    {subscriptionTier === 'free' ? t('subscription.free') : t('subscription.memberBadge')}
                  </span>
                }
              />
              <NavButton
                variant="drawer"
                layoutId="drawer-active-pill"
                active={activeTab === 'contact'}
                onClick={() => handleTabChange('contact')}
                icon={<Mail size={18} />}
                label={t('nav.contact')}
              />
              {showAdminNav && (
                <NavButton
                  variant="drawer"
                  layoutId="drawer-active-pill"
                  tone="admin"
                  active={activeTab === 'admin'}
                  onClick={() => handleTabChange('admin')}
                  icon={<BarChart3 size={18} />}
                  label={t('nav.admin')}
                />
              )}
              {onShowInstallGuide && (
                <button
                  onClick={() => { onShowInstallGuide(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
                >
                  <Download size={18} />
                  <span>{t('nav.installApp')}</span>
                </button>
              )}
              <button
                onClick={() => { handleShareApp(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
              >
                <Share2 size={18} />
                <span>{t('nav.shareApp')}</span>
              </button>
              {onShowPrivacy && (
                <button
                  onClick={() => { onShowPrivacy(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
                >
                  <Shield size={18} />
                  <span>{t('nav.gdpr')}</span>
                </button>
              )}
              {onShowTerms && (
                <button
                  onClick={() => { onShowTerms(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
                >
                  <FileText size={18} />
                  <span>{t('nav.terms')}</span>
                </button>
              )}
              <LanguageSwitcher compact />
              {onToggleDark && (
                <button
                  onClick={() => { onToggleDark(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl transition-all text-sm"
                >
                  {dark ? <Sun size={18} /> : <Moon size={18} />}
                  <span>{dark ? t('nav.lightMode') : t('nav.darkMode')}</span>
                </button>
              )}
              </div>
            </div>

            <div className="shrink-0 p-4 border-t border-black/5 dark:border-white/5 bg-white dark:bg-slate-900 safe-area-bottom">
              <div className="flex items-center gap-3 px-3 py-3 mb-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-stone-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <UserIcon size={16} className="text-stone-500 dark:text-stone-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName || t('common.user')}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { logout(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all text-sm"
              >
                <LogOut size={18} />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {shareNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[400] bg-stone-900 dark:bg-slate-100 text-white dark:text-stone-900 text-sm px-4 py-2.5 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2"
        >
          {shareNotice}
        </div>
      )}
    </div>
  );
}
