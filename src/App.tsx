import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, User, db, OperationType, handleFirestoreError } from './firebase';
import { doc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy, collectionGroup, where } from 'firebase/firestore';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user profile to Firestore (don't block on failure)
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            uid: user.uid,
            displayName: user.displayName || null,
            email: user.email || null,
            photoURL: user.photoURL || null,
            lastLogin: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn('Could not sync user profile:', err);
        }
        setUser(user);

        // Listen for subscription changes on user doc
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (snap) => {
          const data = snap.data();
          if (data) {
            setSubscription({
              tier: data.tier || 'free',
              status: data.subscriptionStatus || 'none',
              stripeCustomerId: data.stripeCustomerId,
              stripeSubscriptionId: data.stripeSubscriptionId,
              currentPeriodEnd: data.currentPeriodEnd || null,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            });
          }
        });
      } else {
        setUser(null);
        setChildren([]);
        setSelectedChildId(null);
        setSubscription({ tier: 'free', status: 'none' });
      }
      setLoading(false);

      // Handle Stripe redirect query params
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success') {
        window.history.replaceState({}, '', window.location.pathname);
      } else if (params.get('subscription') === 'canceled') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch own children
    const childrenRef = collection(db, 'users', user.uid, 'children');
    const qOwn = query(childrenRef, orderBy('createdAt', 'asc'));
    
    // Fetch shared children
    const qShared = query(
      collectionGroup(db, 'children'), 
      where('sharedWith', 'array-contains', user.email)
    );

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

    const unsubscribeOwn = onSnapshot(qOwn, (snapshot) => {
      ownChildren = snapshot.docs.map(doc => ({
        id: doc.id,
        ownerId: user.uid,
        ...doc.data()
      })) as Child[];
      updateChildren();
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'children');
    });

    const unsubscribeShared = onSnapshot(qShared, (snapshot) => {
      sharedChildren = snapshot.docs.map(doc => ({
        id: doc.id,
        ownerId: doc.ref.parent.parent!.id,
        ...doc.data()
      })) as Child[];
      updateChildren();
    }, (error) => {
      // Collection group queries might fail if index is missing, but we'll handle it
      console.warn('Shared children fetch failed (index might be building):', error);
    });

    return () => {
      unsubscribeOwn();
      unsubscribeShared();
    };
  }, [user, selectedChildId]);

  // Listen to all tasks for the selected child (for AI-planner linking)
  useEffect(() => {
    if (!user || !selectedChildId) { setAllTasks([]); return; }
    const selectedChild = children.find(c => c.id === selectedChildId);
    const ownerId = selectedChild?.ownerId || user.uid;
    const tasksRef = collection(db, 'users', ownerId, 'children', selectedChildId, 'tasks');
    const unsub = onSnapshot(tasksRef, (snap) => {
      setAllTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[]);
    }, () => setAllTasks([]));
    return () => unsub();
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
              <Chat childId={selectedChildId!} childName={selectedChild?.name || ''} ownerId={selectedChild?.ownerId || user.uid} tasks={allTasks} taskContext={chatFromTask} onTaskContextUsed={() => setChatFromTask(null)} onCreateTask={(subject, description) => { setPlannerPrefill({ subject, description }); setActiveTab('planner'); }} onCreateTaskFromPhoto={(data) => { setPlannerPrefill(data); setActiveTab('planner'); }} />
            ) : activeTab === 'planner' ? (
              <Planner childId={selectedChildId!} ownerId={selectedChild?.ownerId || user.uid} prefill={plannerPrefill} onPrefillUsed={() => setPlannerPrefill(null)} onOpenAiForTask={(taskId, subject, description, imageUrl) => { setChatFromTask({ taskId, subject, description, imageUrl }); setActiveTab('chat'); }} />
            ) : activeTab === 'library' ? (
              <Library childId={selectedChildId!} ownerId={selectedChild?.ownerId || user.uid} />
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
