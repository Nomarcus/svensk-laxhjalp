import React from 'react';
import { LogOut, MessageSquare, Calendar, BookOpen, User as UserIcon, ChevronDown, Settings, Info, Library, Crown, Download, Users, X, Menu, Moon, Sun, Mail, Shield, FileText, Share2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { logout, User } from '../firebase';
import { cn } from '../utils/cn';
import type { Child, SubscriptionTier } from '../types';
import LanguageSwitcher from './LanguageSwitcher';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  activeTab: 'chat' | 'planner' | 'info' | 'library' | 'subscription' | 'contact' | 'admin';
  setActiveTab: (tab: 'chat' | 'planner' | 'info' | 'library' | 'subscription' | 'contact' | 'admin') => void;
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
  const selectedChild = childrenList.find(c => c.id === selectedChildId);
  const isSharedChild = (child: Child) => child.ownerId !== user.uid;
  const hasSharing = (child: Child) => (child.sharedWith?.length || 0) > 0;

  const handleTabChange = (tab: typeof activeTab) => {
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
        alert(t('library.copiedToClipboard'));
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
                      {selectedChild ? selectedChild.name : t('child.select')}
                    </p>
                    {selectedChild && (isSharedChild(selectedChild) || hasSharing(selectedChild)) && (
                      <Users size={12} className="text-blue-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} className={cn("text-stone-400 transition-transform", showChildSelect && "rotate-180")} />
            </button>

            {showChildSelect && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 z-20 py-2 animate-in fade-in slide-in-from-top-2">
                {childrenList.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      onSelectChild(child.id);
                      setShowChildSelect(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-50 dark:hover:bg-slate-700 transition-colors text-left",
                      selectedChildId === child.id && "text-emerald-600 dark:text-emerald-400 font-medium"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      selectedChildId === child.id ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-stone-100 dark:bg-slate-700"
                    )}>
                      {child.name[0]}
                    </div>
                    <span className="flex-1">{child.name}</span>
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
          {[
            { id: 'chat' as const, icon: <MessageSquare size={20} />, label: t('nav.aiAssistant') },
            { id: 'planner' as const, icon: <Calendar size={20} />, label: t('nav.planner') },
            { id: 'library' as const, icon: <Library size={20} />, label: t('nav.library') },
            { id: 'info' as const, icon: <Info size={20} />, label: t('nav.info') },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === item.id
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setActiveTab('subscription')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'subscription'
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium shadow-sm"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
            )}
          >
            <Crown size={20} />
            <span>{t('nav.subscription')}</span>
            <span className={cn(
              "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
              subscriptionTier === 'pro'
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : subscriptionTier === 'plus'
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400"
            )}>
              {subscriptionTier === 'pro' ? t('subscription.pro') : subscriptionTier === 'plus' ? t('subscription.plus') : t('subscription.free')}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'contact'
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium shadow-sm"
                : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
            )}
          >
            <Mail size={20} />
            <span>{t('nav.contact')}</span>
          </button>
          {showAdminNav && (
            <button
              onClick={() => setActiveTab('admin')}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border border-dashed border-stone-200 dark:border-stone-600",
                activeTab === 'admin'
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
              )}
            >
              <BarChart3 size={20} />
              <span>{t('nav.admin')}</span>
            </button>
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
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/5 shrink-0 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <BookOpen size={16} />
          </div>
          <span className="font-serif italic text-lg">{t('app.name')}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedChild && (
            <button
              onClick={() => setShowMobileMenu(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 dark:bg-slate-800 rounded-full text-sm border border-black/5 dark:border-white/5"
            >
              <UserIcon size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium max-w-[100px] truncate">{selectedChild.name}</span>
            </button>
          )}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {i18n.language === 'ar' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm shrink-0">
            <span>⚠️</span>
            {t('language.betaNotice')}
          </div>
        )}
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden flex items-center bg-white dark:bg-slate-900 border-t border-black/5 dark:border-white/5 shrink-0 safe-area-bottom">
        {[
          { id: 'chat' as const, icon: <MessageSquare size={20} />, label: t('nav.aiHelp') },
          { id: 'planner' as const, icon: <Calendar size={20} />, label: t('nav.plannerShort') },
          { id: 'library' as const, icon: <Library size={20} />, label: t('nav.libraryShort') },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => handleTabChange(item.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
              activeTab === item.id ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowMobileMenu(true)}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
            (activeTab === 'info' || activeTab === 'subscription' || activeTab === 'contact') ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400 dark:text-stone-500"
          )}
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">{t('nav.more')}</span>
        </button>
      </nav>

      {/* Mobile Slide-in Menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="relative ml-auto w-[300px] max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-black/5 dark:border-white/5">
              <h2 className="font-serif italic text-lg">{t('nav.menu')}</h2>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X size={20} className="text-stone-400" />
              </button>
            </div>

            {/* Child Selector in mobile menu */}
            <div className="p-4 border-b border-black/5 dark:border-white/5">
              <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-2">{t('child.label')}</p>
              <div className="space-y-1">
                {childrenList.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelectChild(child.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                      selectedChildId === child.id
                        ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium"
                        : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                      selectedChildId === child.id ? "bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200" : "bg-stone-100 dark:bg-slate-700 text-stone-500 dark:text-stone-400"
                    )}>
                      {child.name[0]}
                    </div>
                    <span className="flex-1 text-sm">{child.name}</span>
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

            <div className="p-4 space-y-1 flex-1">
              <button
                onClick={() => handleTabChange('info')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm",
                  activeTab === 'info' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium" : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                )}
              >
                <Info size={18} />
                <span>{t('nav.info')}</span>
              </button>
              <button
                onClick={() => handleTabChange('subscription')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm",
                  activeTab === 'subscription' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium" : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                )}
              >
                <Crown size={18} />
                <span>{t('nav.subscription')}</span>
                <span className={cn(
                  "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                  "bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400"
                )}>
                  {subscriptionTier === 'pro' ? t('subscription.pro') : subscriptionTier === 'plus' ? t('subscription.plus') : t('subscription.free')}
                </span>
              </button>
              <button
                onClick={() => handleTabChange('contact')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm",
                  activeTab === 'contact' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium" : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                )}
              >
                <Mail size={18} />
                <span>{t('nav.contact')}</span>
              </button>
              {showAdminNav && (
                <button
                  onClick={() => handleTabChange('admin')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm border border-dashed border-stone-200 dark:border-stone-600",
                    activeTab === 'admin' ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium" : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                  )}
                >
                  <BarChart3 size={18} />
                  <span>{t('nav.admin')}</span>
                </button>
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

            <div className="p-4 border-t border-black/5 dark:border-white/5 mt-auto">
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
    </div>
  );
}
