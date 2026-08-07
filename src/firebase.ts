import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  initializeAuth,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  linkWithPopup,
  linkWithRedirect,
  linkWithCredential,
  EmailAuthProvider,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const productionWebHosts = new Set(['foraldrahjalpen.se', 'www.foraldrahjalpen.se']);
const isProductionWeb =
  !Capacitor.isNativePlatform() &&
  typeof window !== 'undefined' &&
  productionWebHosts.has(window.location.hostname);

// Firebase's redirect helper must share the app's origin on browsers that
// block third-party storage (notably iOS Safari). Vercel transparently proxies
// /__/auth/* to Firebase Hosting for these production hosts.
const runtimeFirebaseConfig = isProductionWeb
  ? { ...firebaseConfig, authDomain: window.location.hostname }
  : firebaseConfig;

const app = initializeApp(runtimeFirebaseConfig);
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  },
);
export const auth = initializeAuth(app, {
  // IndexedDB persistence can stall indefinitely inside a Capacitor WKWebView.
  // localStorage-backed persistence is stable on iOS and still keeps sessions.
  persistence: browserLocalPersistence,
});
export const googleProvider = new GoogleAuthProvider();

function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return '';
}

function isMobileWebBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function canUseSameOriginRedirect(): boolean {
  return (
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    runtimeFirebaseConfig.authDomain === window.location.hostname
  );
}

async function getNativeGoogleCredential() {
  const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
  const idToken = result.credential?.idToken ?? null;
  const accessToken = result.credential?.accessToken ?? null;
  if (!idToken && !accessToken) {
    const error = new Error('Google-inloggningen gav ingen giltig autentiseringsuppgift.');
    Object.assign(error, { code: 'auth/credential-unavailable' });
    throw error;
  }
  return GoogleAuthProvider.credential(idToken, accessToken);
}

/** Use native Google auth in Capacitor and same-origin redirect on mobile web. */
export const signInWithGoogle = async () => {
  if (Capacitor.isNativePlatform()) {
    const credential = await getNativeGoogleCredential();
    return signInWithCredential(auth, credential);
  }

  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return signInWithRedirect(auth, googleProvider);
  }

  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = getAuthErrorCode(e);
    if (
      !canUseSameOriginRedirect() ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      throw e;
    }
    return signInWithRedirect(auth, googleProvider);
  }
};

export { getRedirectResult };
export const logout = async () => {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut().catch(() => undefined);
  }
  return signOut(auth);
};

export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName });
  }
  return result;
};

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signInAsGuest = () => signInAnonymously(auth);

export const linkGuestWithGoogle = async () => {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) {
    return signInWithGoogle();
  }
  if (Capacitor.isNativePlatform()) {
    const credential = await getNativeGoogleCredential();
    return linkWithCredential(user, credential);
  }
  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return linkWithRedirect(user, googleProvider);
  }
  return linkWithPopup(user, googleProvider);
};

export const linkGuestWithEmail = async (email: string, password: string, displayName?: string) => {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) {
    return signUpWithEmail(email, password, displayName);
  }
  const credential = EmailAuthProvider.credential(email, password);
  const result = await linkWithCredential(user, credential);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName });
  }
  return result;
};

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isDev = Boolean(import.meta.env.DEV);
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code ?? 'unknown')
    : 'unknown';
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: isDev
      ? {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
          isAnonymous: auth.currentUser?.isAnonymous,
          tenantId: auth.currentUser?.tenantId,
          providerInfo:
            auth.currentUser?.providerData.map((provider) => ({
              providerId: provider.providerId,
              displayName: provider.displayName,
              email: provider.email,
              photoUrl: provider.photoURL,
            })) || [],
        }
      : {
          userId: undefined,
          email: undefined,
          emailVerified: undefined,
          isAnonymous: undefined,
          tenantId: undefined,
          providerInfo: [],
        },
    operationType,
    path,
  };
  if (isDev) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  const minimal = { code: errorCode, operationType, path };
  console.error('Firestore Error:', JSON.stringify(minimal));
  throw new Error(JSON.stringify(minimal));
}

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
};

export { onAuthStateChanged };
export type { User };
