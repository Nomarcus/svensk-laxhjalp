import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, deleteField, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Plus, Trash2, User as UserIcon, X, Check, Share2, Mail, Pencil } from 'lucide-react';
import { cn } from '../utils/cn';
import { isWorkspaceChildId } from '../constants/workspaces';
import { useDialogA11y } from '../hooks/useDialogA11y';
import ConfirmDialog from './ui/ConfirmDialog';

interface ChildWithSharing {
  id: string;
  name: string;
  grade?: string;
  sharedWith?: string[];
}

interface ChildManagerProps {
  onClose: () => void;
}

export default function ChildManager({ onClose }: ChildManagerProps) {
  const { t } = useTranslation();
  const [children, setChildren] = useState<ChildWithSharing[]>([]);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [sharingChildId, setSharingChildId] = useState<string | null>(null);
  const [newShareEmail, setNewShareEmail] = useState('');
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const containerRef = useDialogA11y<HTMLDivElement>(true, onClose);

  useEffect(() => {
    if (!auth.currentUser) return;

    const childrenRef = collection(db, 'users', auth.currentUser.uid, 'children');
    const unsubscribe = onSnapshot(childrenRef, (snapshot) => {
      const childrenData = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as ChildWithSharing))
        .filter((c) => !isWorkspaceChildId(c.id));
      setChildren(childrenData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'children');
    });

    return () => unsubscribe();
  }, []);

  const addChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !auth.currentUser) return;

    try {
      const childrenRef = collection(db, 'users', auth.currentUser.uid, 'children');
      await addDoc(childrenRef, {
        name: newName,
        grade: newGrade,
        createdAt: serverTimestamp()
      });
      setNewName('');
      setNewGrade('');
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'children');
    }
  };

  const deleteChild = async (id: string) => {
    if (!auth.currentUser || isWorkspaceChildId(id)) return;

    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'children', id));
      if (editingChildId === id) {
        setEditingChildId(null);
        setEditName('');
        setEditGrade('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `children/${id}`);
    }
  };

  const confirmDeleteChild = () => {
    if (pendingDeleteId) void deleteChild(pendingDeleteId);
    setPendingDeleteId(null);
  };

  const startEdit = (child: ChildWithSharing) => {
    setIsAdding(false);
    setSharingChildId(null);
    setEditingChildId(child.id);
    setEditName(child.name ?? '');
    setEditGrade(child.grade ?? '');
  };

  const cancelEdit = () => {
    setEditingChildId(null);
    setEditName('');
    setEditGrade('');
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !editingChildId || !editName.trim()) return;

    try {
      const childRef = doc(db, 'users', auth.currentUser.uid, 'children', editingChildId);
      const patch: Record<string, unknown> = { name: editName.trim() };
      if (editGrade.trim()) patch.grade = editGrade.trim();
      else patch.grade = deleteField();
      await updateDoc(childRef, patch);
      cancelEdit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `children/${editingChildId}`);
    }
  };

  const addShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sharingChildId || !newShareEmail.trim() || !auth.currentUser) return;

    const child = children.find(c => c.id === sharingChildId);
    if (!child) return;

    const sharedWith = [...(child.sharedWith || []), newShareEmail.trim().toLowerCase()];

    try {
      const childRef = doc(db, 'users', auth.currentUser.uid, 'children', sharingChildId);
      await updateDoc(childRef, { sharedWith });
      setNewShareEmail('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `children/${sharingChildId}`);
    }
  };

  const removeShare = async (childId: string, email: string) => {
    if (!auth.currentUser) return;
    const child = children.find(c => c.id === childId);
    if (!child) return;

    const sharedWith = (child.sharedWith || []).filter(e => e !== email);

    try {
      const childRef = doc(db, 'users', auth.currentUser.uid, 'children', childId);
      await updateDoc(childRef, { sharedWith });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `children/${childId}`);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="child-manager-title"
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 outline-none"
      >
        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
          <h2 id="child-manager-title" className="text-xl font-serif italic">{t('childManager.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
            aria-label={t('common.close')}
          >
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {children.length === 0 && !isAdding && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserIcon size={32} className="text-stone-300" />
              </div>
              <p className="text-stone-500 text-sm italic">{t('childManager.empty')}</p>
            </div>
          )}

          <div className="space-y-3">
            {children.map((child) => (
              <div key={child.id} className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl group">
                  {editingChildId === child.id ? (
                    <form onSubmit={saveEdit} className="flex flex-col gap-3 w-full min-w-0">
                      <input
                        autoFocus
                        type="text"
                        placeholder={t('childManager.childName')}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <input
                        type="text"
                        placeholder={t('childManager.grade')}
                        value={editGrade}
                        onChange={(e) => setEditGrade(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!editName.trim()}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Check size={16} /> {t('childManager.save')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 py-2 bg-stone-200 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-300"
                        >
                          {t('childManager.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <UserIcon size={20} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-stone-900 truncate">{child.name}</h3>
                      {child.grade && <p className="text-xs text-stone-500 truncate">{child.grade}</p>}
                    </div>
                  </div>
                  )}
                  {editingChildId !== child.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(child)}
                      className="p-2 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      title={t('childManager.edit')}
                      aria-label={t('childManager.edit')}
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingChildId(null);
                        setSharingChildId(sharingChildId === child.id ? null : child.id);
                      }}
                      className={cn(
                        "p-2 rounded-xl transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200",
                        sharingChildId === child.id
                          ? "bg-blue-100 text-blue-600"
                          : child.sharedWith?.length
                            ? "bg-blue-50 text-blue-500"
                            : "text-stone-400 hover:text-blue-600 hover:bg-blue-50"
                      )}
                      title={t('childManager.shareWithParent')}
                      aria-label={t('childManager.shareWithParent')}
                      aria-pressed={sharingChildId === child.id}
                    >
                      <Share2 size={16} />
                      {(child.sharedWith?.length || 0) > 0 && (
                        <span className="text-[10px] font-bold">{child.sharedWith!.length}</span>
                      )}
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(child.id)}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                      title={t('childManager.remove')}
                      aria-label={t('childManager.remove')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  )}
                </div>

                {sharingChildId === child.id && (
                  <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4 animate-in slide-in-from-top-2">
                    <div>
                      <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                        <Share2 size={16} /> {t('childManager.shareTitle')}
                      </div>
                      <p className="text-xs text-blue-600/70 mt-1">
                        {t('childManager.shareDesc')}
                      </p>
                    </div>

                    {(child.sharedWith?.length || 0) > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-medium text-blue-400 uppercase tracking-widest">{t('childManager.sharedWith')}</p>
                        {child.sharedWith?.map(email => (
                          <div key={email} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl text-sm border border-blue-100">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                <Mail size={12} className="text-blue-600" />
                              </div>
                              <span className="text-stone-600">{email}</span>
                            </div>
                            <button
                              onClick={() => removeShare(child.id, email)}
                              className="text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={addShare} className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                          type="email"
                          placeholder={t('childManager.parentEmail')}
                          value={newShareEmail}
                          onChange={(e) => setNewShareEmail(e.target.value)}
                          className="w-full bg-white border border-blue-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!newShareEmail.trim()}
                        className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all text-sm font-medium"
                      >
                        {t('childManager.invite')}
                      </button>
                    </form>
                    <p className="text-[10px] text-blue-500/60">
                      {t('childManager.shareInfo')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isAdding ? (
            <form onSubmit={addChild} className="p-4 border-2 border-dashed border-emerald-100 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-3">
                <input
                  autoFocus
                  type="text"
                  placeholder={t('childManager.childName')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
                <input
                  type="text"
                  placeholder={t('childManager.grade')}
                  value={newGrade}
                  onChange={(e) => setNewGrade(e.target.value)}
                  className="w-full bg-stone-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Check size={16} /> {t('childManager.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 bg-stone-100 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-200 transition-all"
                >
                  {t('childManager.cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => {
                setEditingChildId(null);
                setSharingChildId(null);
                setIsAdding(true);
              }}
              className="w-full py-4 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus size={18} /> {t('childManager.addChild')}
            </button>
          )}
        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-100">
          <button
            onClick={onClose}
            className="w-full py-3 bg-stone-900 text-white rounded-2xl font-medium hover:bg-stone-800 transition-all"
          >
            {t('childManager.done')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        message={t('childManager.removeConfirm')}
        confirmLabel={t('childManager.remove')}
        onConfirm={confirmDeleteChild}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
