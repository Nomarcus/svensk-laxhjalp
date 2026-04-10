import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, onAuthStateChanged, User, db, OperationType, handleFirestoreError } from './firebase';
import { doc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy, collectionGroup, where, limit } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Chat from './components/Chat';
import Planner from './components/Planner';
import HomeworkCorrector from './components/HomeworkCorrector';
import Info from './components/Info';
import Library from './components/Library';
import { ErrorBoundary } from './components/ErrorBoundary';
import ChildManager from './components/ChildManager';
import { Plus } from 'lucide-react';
import type { Child, UserSubscription, Task } from './types';
import InstallPrompt, { InstallGuide } from './components/InstallPrompt';
import PrivacyPolicy from './components/PrivacyPolicy';
import Subscription from './components/Subscription';
import Contact from './components/Contact';
import Admin from './components/Admin';
import { shouldShowAdminNav } from './utils/adminClient';
import CookieConsent from './components/CookieConsent';
import Terms from './components/Terms';
import { useTheme } from './hooks/useTheme';
import LaxhjalpForaldrarLanding from './components/LaxhjalpForaldrarLanding';
import { LAXHJALP_FORALDRAR_PATH, normalizePathname } from './routes';
import { applyHomeSeo, applyParentLandingSeo } from './utils/seoMeta';
import { apiUrl } from './utils/apiBase';

const isFirestorePermissionError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return error.message.includes('permission-denied') || error.message.includes('insufficient permissions');
};

const LAST_LOGIN_STORAGE_KEY = 'foraldrahjalpen_lastLoginDate';
const STRIPE_SYNC_PENDING_KEY = 'foraldrahjalpen_pendingStripeSync';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'planner' | 'corrector' | 'info' | 'library' | 'subscription' | 'contact' | 'admin'>('chat');
  const [subscription, setSubscription] = useState<UserSubscription>({ tier: 'free', status: 'none' });
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showChildManager, setShowChildManager] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [plannerPrefill, setPlannerPrefill] = useState<{
    subject: string;
    description: string;
    workDays?: string[];
    dueDay?: string;
    minutesPerDay?: number;
    imageUrl?: string;
    imageUrls?: string[];
  } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [chatFromTask, setChatFromTask] = useState<{
    taskId: string;
    subject: string;
    description: string;
    imageUrl?: string;
    imageUrls?: string[];
  } | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  /** Bumps when child list / owner map changes so task listener picks up correct ownerId for shared children. */
  const [childMapVersion, setChildMapVersion] = useState(0);
  const { dark, toggle: toggleDark } = useTheme();
  const { t } = useTranslation();
  const [routePath, setRoutePath] = useState(() => normalizePathname(window.location.pathname));
  const userDocUnsubRef = useRef<(() => void) | null>(null);
  const childOwnerByIdRef = useRef<Map<string, string>>(new Map());
  const stripeSyncInFlightRef = useRef(false);

  const goToPath = (path: string) => {
    const next = normalizePathname(path);
    window.history.pushState({}, '', next === '/' ? '/' : next);
    setRoutePath(next);
  };

  useEffect(() => {
    const sync = () => setRoutePath(normalizePathname(window.location.pathname));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (user && routePath === LAXHJALP_FORALDRAR_PATH) {
      window.history.replaceState({}, '', '/');
      setRoutePath('/');
    }
  }, [user, routePath]);

  useEffect(() => {
    if (!user && routePath === LAXHJALP_FORALDRAR_PATH) {
      applyParentLandingSeo();
    } else {
      applyHomeSeo();
    }
  }, [user, routePath]);

  useLayoutEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') !== '1') return;
    setActiveTab('admin');
    window.history.replaceState({}, '', window.location.pathname || '/');
  }, [user]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;

      if (user) {
        const today = new Date().toISOString().split('T')[0];
        const lastWritten = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_LOGIN_STORAGE_KEY) : null;
        try {
          const userRef = doc(db, 'users', user.uid);
          if (lastWritten !== today) {
            await setDoc(
              userRef,
              {
                uid: user.uid,
                displayName: user.displayName || null,
                email: user.email || null,
                photoURL: user.photoURL || null,
                lastLogin: serverTimestamp(),
              },
              { merge: true },
            );
            localStorage.setItem(LAST_LOGIN_STORAGE_KEY, today);
          } else {
            await setDoc(
              userRef,
              {
                uid: user.uid,
                displayName: user.displayName || null,
                email: user.email || null,
                photoURL: user.photoURL || null,
              },
              { merge: true },
            );
          }
        } catch (err) {
          console.warn('Could not sync user profile:', err);
        }
        setUser(user);

        const userDocRef = doc(db, 'users', user.uid);
        userDocUnsubRef.current = onSnapshot(userDocRef, (snap) => {
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

      const params = new URLSearchParams(window.location.search);
      if (params.get('subscription') === 'success') {
        sessionStorage.setItem(STRIPE_SYNC_PENDING_KEY, '1');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (params.get('subscription') === 'canceled') {
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => {
      unsubscribeAuth();
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;
    };
  }, []);

  useEffect(() => {
    const shouldSync = sessionStorage.getItem(STRIPE_SYNC_PENDING_KEY) === '1';
    if (!shouldSync || !user?.email || user.isAnonymous || stripeSyncInFlightRef.current) return;

    const run = async () => {
      stripeSyncInFlightRef.current = true;
      try {
        const token = await user.getIdToken();
        await fetch(apiUrl('/api/billing/sync-stripe-subscription'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.warn('Stripe sync after return failed:', err);
      } finally {
        sessionStorage.removeItem(STRIPE_SYNC_PENDING_KEY);
        stripeSyncInFlightRef.current = false;
      }
    };

    void run();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Fetch own children
    const childrenRef = collection(db, 'users', user.uid, 'children');
    const qOwn = query(childrenRef, orderBy('createdAt', 'asc'));
    
    const canFetchShared = Boolean(user.email);
    const qShared = canFetchShared
      ? query(
          collectionGroup(db, 'children'),
          where('sharedWith', 'array-contains', user.email!),
          limit(10),
        )
      : null;

    let ownChildren: Child[] = [];
    let sharedChildren: Child[] = [];

    const updateChildren = () => {
      const combined = [...ownChildren];
      sharedChildren.forEach((sc) => {
        if (!combined.find((c) => c.id === sc.id)) {
          combined.push(sc);
        }
      });
      const m = new Map<string, string>();
      combined.forEach((c) => m.set(c.id, c.ownerId));
      childOwnerByIdRef.current = m;

      setChildren(combined);
      setSelectedChildId((prev) => {
        if (combined.length === 0) return null;
        if (!prev || !combined.find((c) => c.id === prev)) return combined[0].id;
        return prev;
      });
      setChildMapVersion((v) => v + 1);
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

    const unsubscribeShared = qShared ? onSnapshot(qShared, (snapshot) => {
      sharedChildren = snapshot.docs.map(doc => ({
        id: doc.id,
        ownerId: doc.ref.parent.parent!.id,
        ...doc.data()
      })) as Child[];
      updateChildren();
    }, (error) => {
      // Shared query should never break the app for users without sharing permissions.
      if (isFirestorePermissionError(error)) {
        sharedChildren = [];
        updateChildren();
        return;
      }
      console.warn('Shared children fetch failed:', error);
    }) : () => {};

    return () => {
      unsubscribeOwn();
      unsubscribeShared();
    };
  }, [user]);

  // Listen to tasks for the selected child (capped) for AI-planner linking
  useEffect(() => {
    if (!user || !selectedChildId) {
      setAllTasks([]);
      return;
    }
    const ownerId = childOwnerByIdRef.current.get(selectedChildId) || user.uid;
    const tasksRef = collection(db, 'users', ownerId, 'children', selectedChildId, 'tasks');
    const tasksQ = query(tasksRef, limit(100));
    const unsub = onSnapshot(
      tasksQ,
      (snap) => {
        setAllTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[]);
      },
      () => setAllTasks([]),
    );
    return () => unsub();
  }, [user, selectedChildId, childMapVersion]);

  if (loading) {
    return (
      <div className="min-h-screen app-soft-bg dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showPrivacy) {
    return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
  }

  if (showTerms) {
    return <Terms onBack={() => setShowTerms(false)} />;
  }

  if (!user && routePath === LAXHJALP_FORALDRAR_PATH) {
    return (
      <LaxhjalpForaldrarLanding
        onGetStarted={() => goToPath('/')}
        onShowPrivacy={() => setShowPrivacy(true)}
        onShowTerms={() => setShowTerms(true)}
        dark={dark}
        onToggleDark={toggleDark}
      />
    );
  }

  if (!user) {
    if (new URLSearchParams(window.location.search).get('admin') === '1') {
      return <Admin standalone />;
    }
    return (
      <Auth
        dark={dark}
        onToggleDark={toggleDark}
        onShowPrivacy={() => setShowPrivacy(true)}
        onShowTerms={() => setShowTerms(true)}
      />
    );
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
        onShowPrivacy={() => setShowPrivacy(true)}
        onShowTerms={() => setShowTerms(true)}
        dark={dark}
        onToggleDark={toggleDark}
        showAdminNav={shouldShowAdminNav(user.uid, user.email)}
      >
        {activeTab === 'contact' ? (
          <Contact />
        ) : activeTab === 'subscription' ? (
          <Subscription subscription={subscription} />
        ) : activeTab === 'admin' ? (
          <Admin />
        ) : activeTab === 'info' ? (
          <Info />
        ) : children.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center app-soft-bg">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center surface-card mb-6">
              <Plus size={40} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-serif italic mb-2">{t('welcome.title')}</h2>
            <p className="text-stone-500 max-w-md mb-8">
              {t('welcome.description')}
            </p>
            <button
              onClick={() => setShowChildManager(true)}
              className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-[0_18px_40px_-24px_rgba(5,150,105,0.65)] hover:bg-emerald-700 hover:shadow-[0_22px_48px_-24px_rgba(5,150,105,0.7)] transition-all"
            >
              {t('welcome.addChild')}
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'chat' ? (
              <Chat childId={selectedChildId!} childName={selectedChild?.name || ''} ownerId={selectedChild?.ownerId || user.uid} tasks={allTasks} taskContext={chatFromTask} onTaskContextUsed={() => setChatFromTask(null)} onCreateTask={(subject, description) => { setPlannerPrefill({ subject, description }); setActiveTab('planner'); }} onCreateTaskFromPhoto={(data) => { setPlannerPrefill(data); setActiveTab('planner'); }} />
            ) : activeTab === 'planner' ? (
              <Planner childId={selectedChildId!} ownerId={selectedChild?.ownerId || user.uid} prefill={plannerPrefill} onPrefillUsed={() => setPlannerPrefill(null)} onOpenAiForTask={(taskId, subject, description, imageUrls) => {
                setChatFromTask({
                  taskId,
                  subject,
                  description,
                  imageUrls: imageUrls?.length ? imageUrls : undefined,
                  imageUrl: imageUrls?.[0],
                });
                setActiveTab('chat');
              }} />
            ) : activeTab === 'corrector' ? (
              <HomeworkCorrector
                childName={selectedChild?.name || ''}
                childId={selectedChildId!}
                ownerId={selectedChild?.ownerId || user.uid}
                onCreateTaskFromCorrection={(data) => {
                  setPlannerPrefill(data);
                  setActiveTab('planner');
                }}
              />
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
