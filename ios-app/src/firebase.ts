import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  initializeAuth,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { getReactNativePersistence } from 'firebase/auth/react-native';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { firebaseConfig } from './config';

const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

export const signInWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserDocument(result.user, displayName);
  return result;
}

export async function signInWithAppleIdentityToken(identityToken: string, nonce?: string | null) {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce: nonce || undefined });
  const result = await signInWithCredential(auth, credential);
  await ensureUserDocument(result.user);
  return result;
}

export const logout = () => signOut(auth);

export async function ensureUserDocument(user: User, displayName?: string) {
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email: user.email || null,
      displayName: displayName || user.displayName || null,
      tier: 'free',
      subscriptionStatus: 'none',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
};
