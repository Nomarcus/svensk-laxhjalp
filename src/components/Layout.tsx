import React from 'react';
import { LogOut, MessageSquare, Calendar, BookOpen, User as UserIcon, ChevronDown, Settings, Info, Library, Crown, Download } from 'lucide-react';
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
  const selectedChild = childrenList.find(c => c.id === selectedChildId);

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col md:flex-row font-sans text-stone-900">
      {/* Sidebar / Mobile Nav */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-black/5 flex flex-col">
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
                  <p className="text-sm font-semibold truncate">
                    {selectedChild ? selectedChild.name : 'Välj barn...'}
                  </p>
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
                    <span>{child.name}</span>
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
                : "bg-stone-100 text-stone-500"
            )}>
              {subscriptionTier === 'pro' ? 'Pro' : 'Gratis'}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
