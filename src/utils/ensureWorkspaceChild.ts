import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { WORKSPACE_GENERAL_ID, WORKSPACE_TEACHER_ID } from '../constants/workspaces';

const WORKSPACE_DOC = {
  [WORKSPACE_GENERAL_ID]: { name: 'Allmän läxhjälp', workspaceKind: 'general' as const },
  [WORKSPACE_TEACHER_ID]: { name: 'Lärarläge', workspaceKind: 'teacher' as const },
};

export type WorkspaceChildId = typeof WORKSPACE_GENERAL_ID | typeof WORKSPACE_TEACHER_ID;

export async function ensureWorkspaceChild(uid: string, workspaceId: WorkspaceChildId): Promise<void> {
  const meta = WORKSPACE_DOC[workspaceId];
  await setDoc(
    doc(db, 'users', uid, 'children', workspaceId),
    {
      name: meta.name,
      createdAt: serverTimestamp(),
      workspaceKind: meta.workspaceKind,
    },
    { merge: true },
  );
}
