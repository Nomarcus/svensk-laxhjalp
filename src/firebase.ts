import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  OAuthProvider,
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

const isNativePlatform = Capacitor.isNativePlatform();
const productionWebHosts = new Set(['foraldrahjalpen.se', 'www.foraldrahjalpen.se']);
const isMobileWeb =
  !isNativePlatform &&
  typeof navigator !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const isProductionWeb =
  !isNativePlatform &&
  typeof window !== 'undefined' &&
  productionWebHosts.has(window.location.hostname);

// Firebase's redirect helper only needs to share the app's origin on mobile
// browsers that block third-party storage. Desktop web should keep Firebase's
// default authDomain so popup auth uses the standard Firebase redirect URI.
const runtimeFirebaseConfig = isProductionWeb && isMobileWeb
  ? { ...firebaseConfig, authDomain: window.location.hostname }
  : firebaseConfig;

const app = initializeApp(runtimeFirebaseConfig);
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  },
);
export const auth = initializeAuth(
  app,
  isNativePlatform
    ? {
        // IndexedDB persistence can stall indefinitely inside a Capacitor WKWebView.
        // localStorage-backed persistence is stable on iOS and still keeps sessions.
        persistence: browserLocalPersistence,
      }
    : {
        persistence: browserLocalPersistence,
        // initializeAuth does not install popup/redirect support automatically.
        popupRedirectResolver: browserPopupRedirectResolver,
      },
);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

function getAuthErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code;
  }
  return '';
}

function isMobileWebBrowser(): boolean {
  return isMobileWeb;
}

function canUseSameOriginRedirect(): boolean {
  return (
    !isNativePlatform &&
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

async function getNativeAppleCredential() {
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  const idToken = result.credential?.idToken ?? null;
  const rawNonce = result.credential?.nonce ?? null;
  if (!idToken || !rawNonce) {
    const error = new Error('Apple-inloggningen gav ingen giltig autentiseringsuppgift.');
    Object.assign(error, { code: 'auth/credential-unavailable' });
    throw error;
  }
  return appleProvider.credential({ idToken, rawNonce });
}

/** Use native Sign in with Apple in Capacitor and Firebase OAuth on the web. */
export const signInWithApple = async () => {
  if (isNativePlatform) {
    const credential = await getNativeAppleCredential();
    return signInWithCredential(auth, credential);
  }
  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return signInWithRedirect(auth, appleProvider, browserPopupRedirectResolver);
  }
  try {
    return await signInWithPopup(auth, appleProvider, browserPopupRedirectResolver);
  } catch (e) {
    const code = getAuthErrorCode(e);
    if (!canUseSameOriginRedirect() || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw e;
    }
    return signInWithRedirect(auth, appleProvider, browserPopupRedirectResolver);
  }
};

/** Use native Google auth in Capacitor and same-origin redirect on mobile web. */
export const signInWithGoogle = async () => {
  if (isNativePlatform) {
    const credential = await getNativeGoogleCredential();
    return signInWithCredential(auth, credential);
  }

  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
  }

  try {
    return await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
  } catch (e) {
    const code = getAuthErrorCode(e);
    if (
      !canUseSameOriginRedirect() ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request'
    ) {
      throw e;
    }
    return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
  }
};

/** Complete a pending Firebase web redirect, regardless of which OAuth provider started it. */
export const getAuthRedirectResult = () =>
  isNativePlatform
    ? Promise.resolve(null)
    : getRedirectResult(auth, browserPopupRedirectResolver);

export const logout = async () => {
  if (isNativePlatform) {
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
  if (isNativePlatform) {
    const credential = await getNativeGoogleCredential();
    return linkWithCredential(user, credential);
  }
  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return linkWithRedirect(user, googleProvider, browserPopupRedirectResolver);
  }
  return linkWithPopup(user, googleProvider, browserPopupRedirectResolver);
};

export const linkGuestWithApple = async () => {
  const user = auth.currentUser;
  if (!user || !user.isAnonymous) return signInWithApple();
  if (isNativePlatform) {
    const credential = await getNativeAppleCredential();
    return linkWithCredential(user, credential);
  }
  if (isMobileWebBrowser() && canUseSameOriginRedirect()) {
    return linkWithRedirect(user, appleProvider, browserPopupRedirectResolver);
  }
  return linkWithPopup(user, appleProvider, browserPopupRedirectResolver);
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
