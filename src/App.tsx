import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, onAuthStateChanged, getAuthRedirectResult, User, db, OperationType, handleFirestoreError } from './firebase';
import { doc, setDoc, serverTimestamp, collection, onSnapshot, query, orderBy, collectionGroup, where, limit } from 'firebase/firestore';
import Auth from './components/Auth';
import Layout from './components/Layout';
import Chat from './components/Chat';
import Info from './components/Info';
import { ErrorBoundary } from './components/ErrorBoundary';
import ChildManager from './components/ChildManager';
import { Loader2 } from 'lucide-react';
import type { AppTab, Child, UserSubscription, Task } from './types';
import { isGeneralWorkspaceId, isWorkspaceChildId, WORKSPACE_GENERAL_ID, WORKSPACE_TEACHER_ID } from './constants/workspaces';
import { ensureWorkspaceChild } from './utils/ensureWorkspaceChild';
import { childDisplayName } from './utils/childDisplay';
import InstallPrompt, { InstallGuide } from './components/InstallPrompt';
import PrivacyPolicy from './components/PrivacyPolicy';
import Subscription from './components/Subscription';
import Contact from './components/Contact';
import { shouldShowAdminNav } from './utils/adminClient';
import Terms from './components/Terms';
import { useTheme } from './hooks/useTheme';
import {
  AI_LAXHJALP_PATH,
  LANDING_PATHS,
  LAXHJALP_FORALDRAR_PATH,
  LAXHJALP_LARARE_PATH,
  LAXHJALP_MATTE_PATH,
  LAXHJALP_ONLINE_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
  normalizePathname,
} from './routes';

// Code-split heavy, non-default-tab feature areas and the SEO landing pages
// (only ever shown to logged-out visitors) out of the main bundle.
const Planner = lazy(() => import('./components/Planner'));
const HomeworkCorrector = lazy(() => import('./components/HomeworkCorrector'));
const Library = lazy(() => import('./components/Library'));
const Admin = lazy(() => import('./components/Admin'));
const LaxhjalpForaldrarLanding = lazy(() => import('./components/LaxhjalpForaldrarLanding'));
const LaxhjalpLarareLanding = lazy(() => import('./components/LaxhjalpLarareLanding'));
const AiLaxhjalpLanding = lazy(() => import('./components/AiLaxhjalpLanding'));
const MatteLanding = lazy(() => import('./components/MatteLanding'));
const OnlineLanding = lazy(() => import('./components/OnlineLanding'));

function PageLoader() {
  return (
    <div className="min-h-screen app-soft-bg dark:bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
import {
  applyAiLaxhjalpSeo,
  applyHomeSeo,
  applyMatteSeo,
  applyOnlineSeo,
  applyParentLandingSeo,
  applyTeacherLandingSeo,
} from './utils/seoMeta';

const isFirestorePermissionError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return error.message.includes('permission-denied') || error.message.includes('insufficient permissions');
};

const LAST_LOGIN_STORAGE_KEY = 'foraldrahjalpen_lastLoginDate';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('chat');
  const [subscription, setSubscription] = useState<UserSubscription>({ tier: 'free', status: 'none' });
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showChildManager, setShowChildManager] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [redirectAuthError, setRedirectAuthError] = useState<unknown>(null);
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
  /** True once the own-children Firestore snapshot has fired at least once, so we don't auto-provision a workspace before we actually know the user has no children. */
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const { dark, toggle: toggleDark } = useTheme();
  const { t } = useTranslation();
  const [routePath, setRoutePath] = useState(() => normalizePathname(window.location.pathname));
  const userDocUnsubRef = useRef<(() => void) | null>(null);
  const childOwnerByIdRef = useRef<Map<string, string>>(new Map());
  const autoProvisionAttemptedRef = useRef(false);

  const navigateTab = useCallback(
    (tab: AppTab) => {
      if (tab === 'teacher' && user) {
        void ensureWorkspaceChild(user.uid, WORKSPACE_TEACHER_ID).then(() => setActiveTab('teacher'));
        return;
      }
      setActiveTab(tab);
    },
    [user],
  );

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
    // getRedirectResult completes redirects for every Firebase OAuth provider.
    // Do not label Apple failures as Google failures: that obscures provider
    // configuration errors such as auth/operation-not-allowed.
    void getAuthRedirectResult().catch((error: unknown) => {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      console.error(`[auth] OAuth redirect failed: ${code || 'unknown'}`);
      setRedirectAuthError(error);
    });
  }, []);

  useEffect(() => {
    if (user && LANDING_PATHS.includes(routePath)) {
      window.history.replaceState({}, '', '/');
      setRoutePath('/');
    }
  }, [user, routePath]);

  useEffect(() => {
    if (user) {
      applyHomeSeo();
      return;
    }
    switch (routePath) {
      case LAXHJALP_FORALDRAR_PATH:
        applyParentLandingSeo();
        break;
      case LAXHJALP_LARARE_PATH:
        applyTeacherLandingSeo();
        break;
      case AI_LAXHJALP_PATH:
        applyAiLaxhjalpSeo();
        break;
      case LAXHJALP_MATTE_PATH:
        applyMatteSeo();
        break;
      case LAXHJALP_ONLINE_PATH:
        applyOnlineSeo();
        break;
      default:
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
    // Never leave the native app on the startup spinner indefinitely if the
    // embedded WebView delays Firebase's first auth-state callback.
    const authStartupTimeout = window.setTimeout(() => {
      setUser(auth.currentUser);
      setLoading(false);
    }, 6000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      window.clearTimeout(authStartupTimeout);
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
    });

    return () => {
      window.clearTimeout(authStartupTimeout);
      unsubscribeAuth();
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    setChildrenLoaded(false);
    autoProvisionAttemptedRef.current = false;

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
        if (!prev || !combined.find((c) => c.id === prev)) {
          const firstReal = combined.find((c) => !isWorkspaceChildId(c.id));
          return firstReal?.id ?? combined[0]!.id;
        }
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
      setChildrenLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'children');
      setChildrenLoaded(true);
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

  // Auto-provision the general workspace instead of blocking the user behind a
  // "continue without child" click once we know for sure they have no children yet.
  useEffect(() => {
    if (!user || !childrenLoaded || children.length > 0 || autoProvisionAttemptedRef.current) return;
    autoProvisionAttemptedRef.current = true;
    void ensureWorkspaceChild(user.uid, WORKSPACE_GENERAL_ID).catch((e) =>
      console.warn('Auto-provisioning general workspace failed:', e),
    );
  }, [user, childrenLoaded, children.length]);

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

  useEffect(() => {
    if (selectedChildId && isGeneralWorkspaceId(selectedChildId) && activeTab === 'planner') {
      setActiveTab('chat');
    }
  }, [selectedChildId, activeTab]);

  const handleSelectChild = useCallback(
    (id: string) => {
      setSelectedChildId(id);
      setActiveTab((prev) => (prev === 'teacher' ? 'corrector' : prev));
    },
    [],
  );

  if (loading) {
    return (
      <div className="min-h-screen app-soft-bg dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showPrivacy || routePath === PRIVACY_PATH) {
    return (
      <PrivacyPolicy
        onBack={() => {
          setShowPrivacy(false);
          if (routePath === PRIVACY_PATH) goToPath('/');
        }}
      />
    );
  }

  if (showTerms || routePath === TERMS_PATH) {
    return (
      <Terms
        onBack={() => {
          setShowTerms(false);
          if (routePath === TERMS_PATH) goToPath('/');
        }}
      />
    );
  }

  if (!user && routePath === LAXHJALP_FORALDRAR_PATH) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LaxhjalpForaldrarLanding
          onGetStarted={() => goToPath('/')}
          onShowPrivacy={() => setShowPrivacy(true)}
          onShowTerms={() => setShowTerms(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />
      </Suspense>
    );
  }

  if (!user && routePath === LAXHJALP_LARARE_PATH) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LaxhjalpLarareLanding
          onGetStarted={() => goToPath('/')}
          onShowPrivacy={() => setShowPrivacy(true)}
          onShowTerms={() => setShowTerms(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />
      </Suspense>
    );
  }

  if (!user && routePath === AI_LAXHJALP_PATH) {
    return (
      <Suspense fallback={<PageLoader />}>
        <AiLaxhjalpLanding
          onGetStarted={() => goToPath('/')}
          onShowPrivacy={() => setShowPrivacy(true)}
          onShowTerms={() => setShowTerms(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />
      </Suspense>
    );
  }

  if (!user && routePath === LAXHJALP_MATTE_PATH) {
    return (
      <Suspense fallback={<PageLoader />}>
        <MatteLanding
          onGetStarted={() => goToPath('/')}
          onShowPrivacy={() => setShowPrivacy(true)}
          onShowTerms={() => setShowTerms(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />
      </Suspense>
    );
  }

  if (!user && routePath === LAXHJALP_ONLINE_PATH) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OnlineLanding
          onGetStarted={() => goToPath('/')}
          onShowPrivacy={() => setShowPrivacy(true)}
          onShowTerms={() => setShowTerms(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />
      </Suspense>
    );
  }

  if (!user) {
    if (new URLSearchParams(window.location.search).get('admin') === '1') {
      return (
        <Suspense fallback={<PageLoader />}>
          <Admin standalone />
        </Suspense>
      );
    }
    return (
      <Auth
        dark={dark}
        onToggleDark={toggleDark}
        onShowPrivacy={() => setShowPrivacy(true)}
        onShowTerms={() => setShowTerms(true)}
        redirectError={redirectAuthError}
      />
    );
  }

  const selectedChild = children.find(c => c.id === selectedChildId);

  return (
    <ErrorBoundary>
      <Layout 
        user={user} 
        activeTab={activeTab} 
        setActiveTab={navigateTab}
        childrenList={children}
        selectedChildId={selectedChildId}
        onSelectChild={handleSelectChild}
        onManageChildren={() => setShowChildManager(true)}
        subscriptionTier={subscription.tier}
        onShowInstallGuide={() => setShowInstallGuide(true)}
        onShowPrivacy={() => setShowPrivacy(true)}
        onShowTerms={() => setShowTerms(true)}
        dark={dark}
        onToggleDark={toggleDark}
        showAdminNav={shouldShowAdminNav(user.uid, user.email)}
      >
        <Suspense fallback={<PageLoader />}>
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
            <Loader2 className="animate-spin text-emerald-600 mb-4" size={32} aria-hidden="true" />
            <p className="text-stone-500">{t('welcome.creatingWorkspace')}</p>
          </div>
        ) : (
          <>
            {activeTab === 'teacher' ? (
              <HomeworkCorrector
                childName={t('workspace.teacherLabel')}
                childId={WORKSPACE_TEACHER_ID}
                ownerId={user.uid}
                onCreateTaskFromCorrection={(data) => {
                  void ensureWorkspaceChild(user.uid, WORKSPACE_GENERAL_ID).then(() => {
                    setSelectedChildId(WORKSPACE_GENERAL_ID);
                    setPlannerPrefill(data);
                    setActiveTab('planner');
                  });
                }}
              />
            ) : activeTab === 'chat' ? (
              <Chat
                childId={selectedChildId!}
                childName={selectedChild ? childDisplayName(selectedChild, t) : ''}
                childGrade={selectedChild?.grade}
                ownerId={selectedChild?.ownerId || user.uid}
                tasks={allTasks}
                taskContext={chatFromTask}
                onTaskContextUsed={() => setChatFromTask(null)}
                onManageChildren={() => setShowChildManager(true)}
                onCreateTask={
                  selectedChildId && isGeneralWorkspaceId(selectedChildId)
                    ? undefined
                    : (subject, description) => {
                        setPlannerPrefill({ subject, description });
                        setActiveTab('planner');
                      }
                }
                onCreateTaskFromPhoto={
                  selectedChildId && isGeneralWorkspaceId(selectedChildId)
                    ? undefined
                    : (data) => {
                        setPlannerPrefill(data);
                        setActiveTab('planner');
                      }
                }
              />
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
                childName={selectedChild ? childDisplayName(selectedChild, t) : ''}
                childId={selectedChildId!}
                ownerId={selectedChild?.ownerId || user.uid}
                onCreateTaskFromCorrection={
                  selectedChildId && isGeneralWorkspaceId(selectedChildId)
                    ? undefined
                    : (data) => {
                        setPlannerPrefill(data);
                        setActiveTab('planner');
                      }
                }
              />
            ) : activeTab === 'library' ? (
              <Library childId={selectedChildId!} ownerId={selectedChild?.ownerId || user.uid} />
            ) : (
              <Info />
            )}
          </>
        )}
        </Suspense>
      </Layout>

      {showChildManager && (
        <ChildManager onClose={() => setShowChildManager(false)} />
      )}

      <InstallPrompt />
      {showInstallGuide && <InstallGuide onClose={() => setShowInstallGuide(false)} />}
    </ErrorBoundary>
  );
}
