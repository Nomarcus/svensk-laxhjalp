import {
  addDoc,
  collection,
  db,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from '../firebase';
import type { ChatSession, Child, Message } from '../types';

export function listenChildren(uid: string, onChange: (children: Child[]) => void): Unsubscribe {
  const childrenRef = collection(db, 'users', uid, 'children');
  return onSnapshot(query(childrenRef, orderBy('name')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ownerId: uid, ...item.data() }) as Child));
  });
}

export async function createChild(uid: string, name: string, grade?: string): Promise<string> {
  const childRef = await addDoc(collection(db, 'users', uid, 'children'), {
    name: name.trim(),
    grade: grade?.trim() || '',
    createdAt: serverTimestamp(),
  });
  return childRef.id;
}

export async function ensureChatSession(uid: string, childId: string): Promise<ChatSession> {
  const sessionsRef = collection(db, 'users', uid, 'children', childId, 'chatSessions');
  const existing = await getDocs(query(sessionsRef, orderBy('createdAt', 'desc'), limit(1)));
  const first = existing.docs[0];
  if (first) return { id: first.id, ...first.data() } as ChatSession;

  const sessionRef = await addDoc(sessionsRef, {
    title: 'iOS-chatt',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: sessionRef.id, title: 'iOS-chatt', createdAt: null };
}

export function listenMessages(uid: string, childId: string, sessionId: string, onChange: (messages: Message[]) => void): Unsubscribe {
  const messagesRef = collection(db, 'users', uid, 'children', childId, 'chatSessions', sessionId, 'messages');
  return onSnapshot(query(messagesRef, orderBy('timestamp')), (snapshot) => {
    onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Message));
  });
}

export async function saveMessage(uid: string, childId: string, sessionId: string, role: 'user' | 'model', content: string) {
  await addDoc(collection(db, 'users', uid, 'children', childId, 'chatSessions', sessionId, 'messages'), {
    role,
    content,
    timestamp: serverTimestamp(),
  });
  await setDoc(
    doc(db, 'users', uid, 'children', childId, 'chatSessions', sessionId),
    { updatedAt: serverTimestamp(), title: content.slice(0, 80) || 'iOS-chatt' },
    { merge: true },
  );
}
