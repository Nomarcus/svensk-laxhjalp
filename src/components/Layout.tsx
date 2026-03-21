import React from 'react';
import { LogOut, MessageSquare, Calendar, BookOpen, User as UserIcon, ChevronDown, Settings, Info, Library, Crown, Download, Users, X, Menu } from 'lucide-react';
import { logout, User } from '../firebase';
import { cn } from '../utils/cn';
import type { Child, SubscriptionTier } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  activeTab: 'chat' | 'planner' | 'info' | 'library' | 'subscription';
  setActiveTab: (tab: 'chat' | 'planner' | 'info' | 'library' | 'subscription') => void;
  childrenList: Child[];
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  onManageChildren: () => void;
  subscriptionTier?: SubscriptionTier;
  onShowInstallGuide?: () => void;
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
  onShowInstallGuide
}: LayoutProps) {
  const [showChildSelect, setShowChildSelect] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const selectedChild = childrenList.find(c => c.id === selectedChildId);
  const isSharedChild = (child: Child) => child.ownerId !== user.uid;
  const hasSharing = (child: Child) => (child.sharedWith?.length || 0) > 0;

  const handleTabChange = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setShowMobileMenu(false);
  };

  return (
    <div className="h-dvh bg-[#F5F5F0] flex flex-col md:flex-row font-sans text-stone-900">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-white border-r border-black/5 flex-col shrink-0">
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={20} />
            </div>
            <h1 className="font-serif italic text-xl">Läxhjälp</h1>
          </div>
          <p className="text-xs text-stone-500 uppercase tracking-widest font-medium">Föräldraassistans</p>
        </div>

        {/* Child Selector */}
        <div className="px-4 py-6 border-b border-black/5">
          <div className="relative">
            <button
              onClick={() => setShowChildSelect(!showChildSelect)}
              className="w-full flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-black/5 hover:bg-stone-100 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserIcon size={16} className="text-emerald-600" />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">Barn</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold truncate">
                      {selectedChild ? selectedChild.name : 'Välj barn...'}
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
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-black/5 z-20 py-2 animate-in fade-in slide-in-from-top-2">
                {childrenList.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      onSelectChild(child.id);
                      setShowChildSelect(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 hover:bg-stone-50 transition-colors text-left",
                      selectedChildId === child.id && "text-emerald-600 font-medium"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      selectedChildId === child.id ? "bg-emerald-100" : "bg-stone-100"
                    )}>
                      {child.name[0]}
                    </div>
                    <span className="flex-1">{child.name}</span>
                    {isSharedChild(child) && (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Delad med dig</span>
                    )}
                    {!isSharedChild(child) && hasSharing(child) && (
                      <Users size={12} className="text-blue-400" />
                    )}
                  </button>
                ))}
                <div className="h-px bg-stone-100 my-2 mx-4" />
                <button
                  onClick={() => {
                    onManageChildren();
                    setShowChildSelect(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all text-left text-sm"
                >
                  <Settings size={16} />
                  <span>Hantera barn...</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'chat' ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <MessageSquare size={20} />
            <span>AI-Assistent</span>
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'planner' ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Calendar size={20} />
            <span>Läxplanering</span>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'library' ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Library size={20} />
            <span>Resursbibliotek</span>
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'info' ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Info size={20} />
            <span>Hur det fungerar</span>
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              activeTab === 'subscription' ? "bg-emerald-50 text-emerald-700 font-medium shadow-sm" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            <Crown size={20} />
            <span>Abonnemang</span>
            <span className={cn(
              "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
              subscriptionTier === 'pro'
                ? "bg-amber-100 text-amber-700"
                : subscriptionTier === 'plus'
                  ? "bg-blue-100 text-blue-700"
                  : "bg-stone-100 text-stone-500"
            )}>
              {subscriptionTier === 'pro' ? 'Pro' : subscriptionTier === 'plus' ? 'Plus' : 'Gratis'}
            </span>
          </button>
        </nav>

        <div className="p-4 border-t border-black/5 mt-auto">
          {onShowInstallGuide && (
            <button
              onClick={onShowInstallGuide}
              className="w-full flex items-center gap-3 px-4 py-2 mb-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
            >
              <Download size={18} />
              <span className="text-sm">Installera appen</span>
            </button>
          )}
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
                <UserIcon size={16} className="text-stone-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.displayName || 'Användare'}</p>
              <p className="text-xs text-stone-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm">Logga ut</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-black/5 shrink-0 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <BookOpen size={16} />
          </div>
          <span className="font-serif italic text-lg">Läxhjälp</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedChild && (
            <button
              onClick={() => setShowMobileMenu(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 rounded-full text-sm border border-black/5"
            >
              <UserIcon size={14} className="text-emerald-600" />
              <span className="font-medium max-w-[100px] truncate">{selectedChild.name}</span>
              {(isSharedChild(selectedChild) || hasSharing(selectedChild)) && (
                <Users size={10} className="text-blue-500" />
              )}
            </button>
          )}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="p-2 text-stone-500 hover:bg-stone-100 rounded-xl transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden flex items-center bg-white border-t border-black/5 shrink-0 safe-area-bottom">
        <button
          onClick={() => handleTabChange('chat')}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
            activeTab === 'chat' ? "text-emerald-600" : "text-stone-400"
          )}
        >
          <MessageSquare size={20} />
          <span className="text-[10px] font-medium">AI-Hjälp</span>
        </button>
        <button
          onClick={() => handleTabChange('planner')}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
            activeTab === 'planner' ? "text-emerald-600" : "text-stone-400"
          )}
        >
          <Calendar size={20} />
          <span className="text-[10px] font-medium">Planering</span>
        </button>
        <button
          onClick={() => handleTabChange('library')}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
            activeTab === 'library' ? "text-emerald-600" : "text-stone-400"
          )}
        >
          <Library size={20} />
          <span className="text-[10px] font-medium">Bibliotek</span>
        </button>
        <button
          onClick={() => setShowMobileMenu(true)}
          className={cn(
            "flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 transition-colors",
            (activeTab === 'info' || activeTab === 'subscription') ? "text-emerald-600" : "text-stone-400"
          )}
        >
          <Menu size={20} />
          <span className="text-[10px] font-medium">Mer</span>
        </button>
      </nav>

      {/* Mobile Slide-in Menu */}
      {showMobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowMobileMenu(false)}
          />
          {/* Panel */}
          <div className="relative ml-auto w-[300px] max-w-[85vw] bg-white h-full flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-4 border-b border-black/5">
              <h2 className="font-serif italic text-lg">Meny</h2>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={20} className="text-stone-400" />
              </button>
            </div>

            {/* Child Selector in mobile menu */}
            <div className="p-4 border-b border-black/5">
              <p className="text-[10px] font-medium text-stone-400 uppercase tracking-widest mb-2">Välj barn</p>
              <div className="space-y-1">
                {childrenList.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => {
                      onSelectChild(child.id);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left",
                      selectedChildId === child.id
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-stone-600 hover:bg-stone-50"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium",
                      selectedChildId === child.id ? "bg-emerald-200 text-emerald-800" : "bg-stone-100 text-stone-500"
                    )}>
                      {child.name[0]}
                    </div>
                    <span className="flex-1 text-sm">{child.name}</span>
                    {isSharedChild(child) && (
                      <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">Delad</span>
                    )}
                    {!isSharedChild(child) && hasSharing(child) && (
                      <Users size={12} className="text-blue-400" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    onManageChildren();
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all text-left text-sm"
                >
                  <Settings size={16} />
                  <span>Hantera barn...</span>
                </button>
              </div>
            </div>

            {/* Extra menu items */}
            <div className="p-4 space-y-1 flex-1">
              <button
                onClick={() => handleTabChange('info')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm",
                  activeTab === 'info' ? "bg-emerald-50 text-emerald-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <Info size={18} />
                <span>Hur det fungerar</span>
              </button>
              <button
                onClick={() => handleTabChange('subscription')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-sm",
                  activeTab === 'subscription' ? "bg-emerald-50 text-emerald-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <Crown size={18} />
                <span>Abonnemang</span>
                <span className={cn(
                  "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                  subscriptionTier === 'pro'
                    ? "bg-amber-100 text-amber-700"
                    : subscriptionTier === 'plus'
                      ? "bg-blue-100 text-blue-700"
                      : "bg-stone-100 text-stone-500"
                )}>
                  {subscriptionTier === 'pro' ? 'Pro' : subscriptionTier === 'plus' ? 'Plus' : 'Gratis'}
                </span>
              </button>
              {onShowInstallGuide && (
                <button
                  onClick={() => { onShowInstallGuide(); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-stone-600 hover:bg-stone-50 rounded-xl transition-all text-sm"
                >
                  <Download size={18} />
                  <span>Installera appen</span>
                </button>
              )}
            </div>

            {/* User info + logout */}
            <div className="p-4 border-t border-black/5 mt-auto">
              <div className="flex items-center gap-3 px-3 py-3 mb-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-stone-200 rounded-full flex items-center justify-center">
                    <UserIcon size={16} className="text-stone-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName || 'Användare'}</p>
                  <p className="text-xs text-stone-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { logout(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm"
              >
                <LogOut size={18} />
                <span>Logga ut</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
