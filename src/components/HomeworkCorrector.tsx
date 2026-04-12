import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Image as ImageIcon, Loader2, Send, X, CheckSquare, CalendarPlus, History, Save } from 'lucide-react';
import { compressImage } from '../utils/image';
import { isLikelyImageFile } from '../utils/imageUpload';
import { analyzeHomeworkForTask, correctHomeworkFromImages } from '../services/geminiService';
import { cn } from '../utils/cn';
import { auth, db, OperationType, handleFirestoreError } from '../firebase';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import type { LibraryItem } from '../types';
import FreeTierUsageBar from './FreeTierUsageBar';
import { bumpUsageRefresh } from '../utils/usageRefresh';

interface HomeworkCorrectorProps {
  childName: string;
  childId: string;
  ownerId: string;
  onCreateTaskFromCorrection?: (data: {
    subject: string;
    description: string;
    workDays?: string[];
    dueDay?: string;
    minutesPerDay?: number;
    imageUrl?: string;
    imageUrls?: string[];
  }) => void;
}

const MAX_IMAGES = 5;

export default function HomeworkCorrector({ childName, childId, ownerId, onCreateTaskFromCorrection }: HomeworkCorrectorProps) {
  const { t, i18n } = useTranslation();
  const [images, setImages] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  const [result, setResult] = useState('');
  const [recentCorrections, setRecentCorrections] = useState<LibraryItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!auth.currentUser || !childId) return;
    const q = query(
      collection(db, 'users', ownerId, 'children', childId, 'library'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as LibraryItem)
        .filter((x) => x.type === 'correction')
        .slice(0, 10);
      setRecentCorrections(data);
    });
    return () => unsub();
  }, [childId, ownerId]);

  const formatCorrectionText = (raw: string) =>
    raw
      .replace(/\r/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\*\*/g, '')
      .replace(/^\s*\*\s+/gm, '- ')
      .replace(/`/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const pushImage = async (dataUrl: string) => {
    let finalUrl = dataUrl;
    try {
      finalUrl = await compressImage(dataUrl);
    } catch {
      // Keep original if compression fails.
    }
    setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, finalUrl].slice(0, MAX_IMAGES)));
  };

  const onCreateTask = async () => {
    if (!result.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      const parsed = await analyzeHomeworkForTask(result);
      bumpUsageRefresh();
      onCreateTaskFromCorrection?.({
        subject: parsed.subject || t('planner.subject'),
        description: parsed.description || result.slice(0, 120),
        workDays: parsed.suggestedWorkDays || [],
        dueDay: parsed.suggestedDueDay || undefined,
        minutesPerDay: parsed.minutesPerDay || undefined,
        imageUrl: images[0],
        imageUrls: images.slice(0, MAX_IMAGES),
      });
    } finally {
      setCreatingTask(false);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handlePickedFiles = async (files: File[]) => {
    for (const file of files) {
      if (!isLikelyImageFile(file)) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await pushImage(dataUrl);
      } catch {
        /* iOS / HEIC */
      }
    }
  };

  const onCorrect = async () => {
    if (images.length === 0 || loading) return;
    setLoading(true);
    try {
      const text = await correctHomeworkFromImages(images, extraContext, i18n.language || 'sv');
      setResult(formatCorrectionText(text || t('corrector.emptyResultFallback')));
      setSavedNow(false);
      bumpUsageRefresh();
    } catch {
      setResult(t('chat.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const onSaveCorrection = async () => {
    if (!result.trim() || savingCorrection || !auth.currentUser) return;
    setSavingCorrection(true);
    try {
      await addDoc(collection(db, 'users', ownerId, 'children', childId, 'library'), {
        title: (result.split('\n')[0] || t('corrector.title')).slice(0, 80),
        content: result,
        type: 'correction',
        imageUrl: images[0] || null,
        imageUrls: images,
        subject: t('corrector.subjectLabel'),
        createdAt: serverTimestamp(),
      });
      setSavedNow(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${ownerId}/children/${childId}/library`);
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto app-soft-bg p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-black/5 dark:border-white/5 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckSquare size={20} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-serif italic">{t('corrector.title')}</h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">{t('corrector.subtitle', { name: childName })}</p>
            </div>
          </div>

          <div className="mb-4">
            <FreeTierUsageBar className="w-full" />
          </div>

          <div className="grid sm:grid-cols-2 gap-2 mb-4">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading || images.length >= MAX_IMAGES}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all',
                loading || images.length >= MAX_IMAGES
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              )}
            >
              <Camera size={18} />
              {t('chat.takePhoto')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || images.length >= MAX_IMAGES}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all',
                loading || images.length >= MAX_IMAGES
                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              )}
            >
              <ImageIcon size={18} />
              {t('chat.chooseImage')}
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const el = e.currentTarget;
              const picked = el.files?.length ? Array.from(el.files) : [];
              el.value = '';
              void handlePickedFiles(picked);
            }}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const el = e.currentTarget;
              const picked = el.files?.length ? Array.from(el.files) : [];
              el.value = '';
              void handlePickedFiles(picked);
            }}
            className="hidden"
          />

          <div className="text-xs text-stone-500 dark:text-stone-400 mb-3">
            {t('corrector.imageHint', { max: MAX_IMAGES })}
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
              {images.map((img, idx) => (
                <div key={`${img.slice(0, 30)}-${idx}`} className="relative">
                  <img src={img} alt="" className="h-20 w-full object-cover rounded-lg border border-black/10 dark:border-white/10" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                    aria-label={t('chat.removeAttachment')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
            {t('corrector.extraContext')}
          </label>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder={t('corrector.extraContextPlaceholder')}
            rows={3}
            className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />

          <button
            type="button"
            onClick={onCorrect}
            disabled={loading || images.length === 0}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {loading ? t('corrector.correcting') : t('corrector.submit')}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-black/5 dark:border-white/5 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)]">
          <h3 className="text-base font-semibold mb-3">{t('corrector.resultTitle')}</h3>
          {result ? (
            <div className="space-y-4">
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700 dark:text-stone-200">
                {result}
              </div>
              <div className="flex flex-wrap gap-2">
                {onCreateTaskFromCorrection && (
                  <button
                    type="button"
                    onClick={onCreateTask}
                    disabled={creatingTask}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {creatingTask ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
                    {creatingTask ? t('corrector.creatingTask') : t('corrector.createTask')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSaveCorrection}
                  disabled={savingCorrection || savedNow}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {savingCorrection ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {savedNow ? t('corrector.saved') : t('corrector.saveCorrection')}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {t('corrector.emptyResult')}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-black/5 dark:border-white/5 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-2 mb-3">
            <History size={16} className="text-stone-500" />
            <h3 className="text-base font-semibold">{t('corrector.recentTitle')}</h3>
          </div>
          {recentCorrections.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">{t('corrector.recentEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {recentCorrections.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setResult(item.content || '');
                    setImages(item.imageUrls?.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : []);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-black/5 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="text-sm font-medium text-stone-800 dark:text-stone-100 line-clamp-1">{item.title}</div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">{item.content}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
