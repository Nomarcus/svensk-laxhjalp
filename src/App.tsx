import React, { useState, useEffect } from 'react';
import { supabase, handleDbError, User } from './supabase';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Chat from './components/Chat';
import Planner from './components/Planner';
import Info from './components/Info';
import Library from './components/Library';
import { ErrorBoundary } from './components/ErrorBoundary';
import ChildManager from './components/ChildManager';
import { Plus } from 'lucide-react';
import type { Child, UserSubscription, Task } from './types';
import InstallPrompt, { InstallGuide } from './components/InstallPrompt';
import PrivacyPolicy from './components/PrivacyPolicy';
import Subscription from './components/Subscription';
import CookieConsent from './components/CookieConsent';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'planner' | 'info' | 'library' | 'subscription'>('chat');
  const [subscription, setSubscription] = useState<UserSubscription>({ tier: 'free', status: 'none' });
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showChildManager, setShowChildManager] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [plannerPrefill, setPlannerPrefill] = useState<{ subject: string; description: string; workDays?: string[]; dueDay?: string; minutesPerDay?: number; imageUrl?: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [chatFromTask, setChatFromTask] = useState<{ taskId: string; subject: string; description: string; imageUrl?: string } | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;

      if (currentUser) {
        // Sync user profile to Supabase
        try {
          await supabase.from('users').upsert({
            id: currentUser.id,
            display_name: currentUser.user_metadata?.display_name || currentUser.user_metadata?.full_name || null,
            email: currentUser.email || null,
            photo_url: currentUser.user_metadata?.avatar_url || null,
            last_login: new Date().toISOString(),
          }, { onConflict: 'id' });
        } catch (err) {
          console.warn('Could not sync user profile:', err);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setChildren([]);
        setSelectedChildId(null);
        setSubscription({ tier: 'free', status: 'none' });
      }
      setLoading(false);

      // Handle Stripe redirect query params
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success' || params.get('subscription') === 'canceled') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => authSub.unsubscribe();
  }, []);

  // Subscription listener
  useEffect(() => {
    if (!user) return;

    // Initial fetch
    const fetchSub = async () => {
      const { data } = await supabase.from('users').select('tier, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end').eq('id', user.id).single();
      if (data) {
        setSubscription({
          tier: data.tier || 'free',
          status: data.subscription_status || 'none',
          stripe_customer_id: data.stripe_customer_id,
          stripe_subscription_id: data.stripe_subscription_id,
          current_period_end: data.current_period_end || null,
          cancel_at_period_end: data.cancel_at_period_end || false,
        });
      }
    };
    fetchSub();

    // Realtime subscription on user doc
    const channel = supabase
      .channel(`user-sub-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, (payload) => {
        const data = payload.new as any;
        setSubscription({
          tier: data.tier || 'free',
          status: data.subscription_status || 'none',
          stripe_customer_id: data.stripe_customer_id,
          stripe_subscription_id: data.stripe_subscription_id,
          current_period_end: data.current_period_end || null,
          cancel_at_period_end: data.cancel_at_period_end || false,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Children listener
  useEffect(() => {
    if (!user) return;

    let ownChildren: Child[] = [];
    let sharedChildren: Child[] = [];

    const updateChildren = () => {
      const combined = [...ownChildren];
      sharedChildren.forEach(sc => {
        if (!combined.find(c => c.id === sc.id)) {
          combined.push(sc);
        }
      });
      setChildren(combined);

      if (combined.length > 0) {
        if (!selectedChildId || !combined.find(c => c.id === selectedChildId)) {
          setSelectedChildId(combined[0].id);
        }
      } else {
        setSelectedChildId(null);
      }
    };

    // Fetch own children
    const fetchOwn = async () => {
      const { data, error } = await supabase.from('children').select('*').eq('owner_id', user.id).order('created_at', { ascending: true });
      if (!error && data) {
        ownChildren = data as Child[];
        updateChildren();
      }
    };

    // Fetch shared children
    const fetchShared = async () => {
      if (!user.email) return;
      const { data, error } = await supabase.from('children').select('*').contains('shared_with', [user.email]);
      if (!error && data) {
        sharedChildren = data as Child[];
        updateChildren();
      }
    };

    fetchOwn();
    fetchShared();

    // Realtime for own children
    const ownChannel = supabase
      .channel(`own-children-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter: `owner_id=eq.${user.id}` }, () => {
        fetchOwn();
      })
      .subscribe();

    // Realtime for shared children (refetch on any children change)
    const sharedChannel = supabase
      .channel(`shared-children-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, () => {
        fetchShared();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ownChannel);
      supabase.removeChannel(sharedChannel);
    };
  }, [user, selectedChildId]);

  // Listen to all tasks for the selected child
  useEffect(() => {
    if (!user || !selectedChildId) { setAllTasks([]); return; }

    const fetchTasks = async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('child_id', selectedChildId);
      if (!error && data) setAllTasks(data as Task[]);
    };
    fetchTasks();

    const channel = supabase
      .channel(`all-tasks-${selectedChildId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `child_id=eq.${selectedChildId}` }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedChildId, children]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showPrivacy) {
    return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
  }

  if (!user) {
    return <Auth onShowPrivacy={() => setShowPrivacy(true)} />;
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <ErrorBoundary>
      <Layout
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        childrenList={children}
        selectedChildId={selectedChildId}
        onSelectChild={setSelectedChildId}
        onManageChildren={() => setShowChildManager(true)}
        subscriptionTier={subscription.tier}
        onShowInstallGuide={() => setShowInstallGuide(true)}
      >
        {activeTab === 'subscription' ? (
          <Subscription subscription={subscription} />
        ) : activeTab === 'info' ? (
          <Info />
        ) : children.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#F5F5F0]">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
              <Plus size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-serif italic mb-2">Välkommen till Läxhjälpen!</h2>
            <p className="text-stone-500 max-w-md mb-8">
              Börja med att lägga till ett barn för att komma igång med läxhjälp och planering.
            </p>
            <button
              onClick={() => setShowChildManager(true)}
              className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg hover:bg-emerald-700 transition-all"
            >
              Lägg till barn
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chat' ? (
              <Chat childId={selectedChildId!} childName={selectedChild?.name || ''} ownerId={selectedChild?.owner_id || user.id} tasks={allTasks} taskContext={chatFromTask} onTaskContextUsed={() => setChatFromTask(null)} onCreateTask={(subject, description) => { setPlannerPrefill({ subject, description }); setActiveTab('planner'); }} onCreateTaskFromPhoto={(data) => { setPlannerPrefill(data); setActiveTab('planner'); }} />
            ) : activeTab === 'planner' ? (
              <Planner childId={selectedChildId!} ownerId={selectedChild?.owner_id || user.id} prefill={plannerPrefill} onPrefillUsed={() => setPlannerPrefill(null)} onOpenAiForTask={(taskId, subject, description, imageUrl) => { setChatFromTask({ taskId, subject, description, imageUrl }); setActiveTab('chat'); }} />
            ) : activeTab === 'library' ? (
              <Library childId={selectedChildId!} ownerId={selectedChild?.owner_id || user.id} />
            ) : (
              <Info />
            )}
          </>
        )}
      </Layout>

      {showChildManager && (
        <ChildManager onClose={() => setShowChildManager(false)} />
      )}

      <InstallPrompt />
      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
      <CookieConsent />
    </ErrorBoundary>
  );
}
