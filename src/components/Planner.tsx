import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutList, Calendar, Calculator, BookOpen, Languages, Beaker, Globe, Book, Clock, CalendarCheck, Camera, MessageSquare, X, Image as ImageIcon, Eye, EyeOff, Sparkles, Loader2, GraduationCap, Flame } from 'lucide-react';
import { db, auth, onAuthStateChanged, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, arrayUnion, arrayRemove, getDocs, orderBy, limit, getDoc, setDoc } from 'firebase/firestore';
import { format, startOfWeek, addDays, getWeek, getYear, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { compressImage } from '../utils/image';
import type { Task } from '../types';
import { computeNextStreakOnCompletion, type ParentStreakDoc } from '../utils/parentStreak';
import { generateStudyPlan, generateExamPrep } from '../services/geminiService';
import StudyPlanModal from './StudyPlanModal';
import ExamPrepModal from './ExamPrepModal';
import ScheduleCalendarModal, { getDateInPlannerWeek } from './ScheduleCalendarModal';

interface PlannerProps {
  childId: string;
  ownerId: string;
  prefill?: { subject: string; description: string; workDays?: string[]; dueDay?: string; minutesPerDay?: number; imageUrl?: string; imageUrls?: string[] } | null;
  onPrefillUsed?: () => void;
  onOpenAiForTask?: (taskId: string, subject: string, description: string, imageUrls?: string[]) => void;
}

const PLANNER_WEEK_OPTS = { weekStartsOn: 1 as const, firstWeekContainsDate: 4 as const };

const DAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];

export default function Planner({ childId, ownerId, prefill, onPrefillUsed, onOpenAiForTask }: PlannerProps) {
  const { t } = useTranslation();
  const plannerCameraRef = useRef<HTMLInputElement>(null);
  const editTaskCameraRef = useRef<HTMLInputElement>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'EEEE', { locale: sv }));
  const [showAddModal, setShowAddModal] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showStudyPlan, setShowStudyPlan] = useState(false);
  const [studyPlanContent, setStudyPlanContent] = useState<string | null>(null);
  const [studyPlanLoading, setStudyPlanLoading] = useState(false);
  const [newTaskType, setNewTaskType] = useState<'homework' | 'exam'>('homework');
  const [examPrepTask, setExamPrepTask] = useState<Task | null>(null);
  const [examPrepContent, setExamPrepContent] = useState<string | null>(null);
  const [examPrepLoading, setExamPrepLoading] = useState(false);
  const [parentStreak, setParentStreak] = useState<ParentStreakDoc | null>(null);

  // Form state
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDateType, setNewDateType] = useState<'due' | 'work'>('due');
  const [newWorkDays, setNewWorkDays] = useState<string[]>([]);
  const [newDueDay, setNewDueDay] = useState('');
  const [newMinutesPerDay, setNewMinutesPerDay] = useState<number | ''>('');

  // Handle prefill from AI chat
  useEffect(() => {
    if (prefill) {
      setNewSubject(prefill.subject);
      setNewDesc(prefill.description);
      if (prefill.workDays?.length) setNewWorkDays(prefill.workDays);
      if (prefill.dueDay) setNewDueDay(prefill.dueDay);
      if (prefill.minutesPerDay) setNewMinutesPerDay(prefill.minutesPerDay);
      if (prefill.imageUrls?.length) setTaskImages(prefill.imageUrls);
      else if (prefill.imageUrl) setTaskImages([prefill.imageUrl]);
      setShowAddModal(true);
      onPrefillUsed?.();
    }
  }, [prefill]);

  const viewWeek = getWeek(viewDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const viewYear = getYear(viewDate);

  useEffect(() => {
    if (!auth.currentUser || !childId) return;

    const q = query(
      collection(db, 'users', ownerId, 'children', childId, 'tasks'),
      where('weekNumber', '==', viewWeek),
      where('year', '==', viewYear)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(tks);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${ownerId}/children/${childId}/tasks`);
    });

    return () => unsubscribe();
  }, [viewWeek, viewYear, childId, ownerId]);

  useEffect(() => {
    if (!childId) {
      setParentStreak(null);
      return;
    }
    let unsubStreak: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubStreak?.();
      unsubStreak = undefined;
      if (!user) {
        setParentStreak(null);
        return;
      }
      const streakRef = doc(db, 'users', user.uid, 'parentStreaks', childId);
      unsubStreak = onSnapshot(streakRef, (snapshot) => {
        if (!snapshot.exists()) {
          setParentStreak(null);
          return;
        }
        setParentStreak(snapshot.data() as ParentStreakDoc);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/parentStreaks/${childId}`);
      });
    });
    return () => {
      unsubAuth();
      unsubStreak?.();
    };
  }, [childId]);

  const recordParentWeeklyStreak = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !childId) return;
    const streakRef = doc(db, 'users', uid, 'parentStreaks', childId);
    try {
      const snap = await getDoc(streakRef);
      const existing = snap.exists() ? (snap.data() as Partial<ParentStreakDoc>) : undefined;
      const next = computeNextStreakOnCompletion(existing, new Date());
      if (!next) return;
      await setDoc(streakRef, next, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/parentStreaks/${childId}`);
    }
  };

  const resetForm = () => {
    setNewSubject('');
    setNewDesc('');
    setNewDateType('due');
    setNewWorkDays([]);
    setNewDueDay(selectedDay);
    setNewMinutesPerDay('');
    setTaskImages([]);
    setNewTaskType('homework');
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !auth.currentUser || !childId) return;

    try {
      const taskData: any = {
        day: selectedDay,
        subject: newSubject,
        description: newDesc,
        completed: false,
        dateType: newDateType,
        weekNumber: viewWeek,
        year: viewYear,
        createdAt: new Date().toISOString(),
        taskType: newTaskType,
      };

      if (newMinutesPerDay) {
        taskData.minutesPerDay = Number(newMinutesPerDay);
      }
      taskData.imageUrls = taskImages;
      taskData.imageUrl = taskImages[0] || null;

      taskData.dueDay = newDueDay || selectedDay;
      taskData.workDays = newWorkDays.length > 0 ? newWorkDays : [];

      await addDoc(collection(db, 'users', ownerId, 'children', childId, 'tasks'), taskData);

      resetForm();
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${ownerId}/children/${childId}/tasks`);
    }
  };

  const toggleTask = async (task: Task, day?: string) => {
    if (!auth.currentUser || !childId) return;
    const taskRef = doc(db, 'users', ownerId, 'children', childId, 'tasks', task.id);
    try {
      // Get all days this task spans
      const allDays = new Set<string>();
      if (task.day) allDays.add(task.day);
      if (task.dueDay) allDays.add(task.dueDay);
      task.workDays?.forEach(d => allDays.add(d));

      // If task only has one day or no day specified, toggle whole task
      if (allDays.size <= 1 || !day) {
        const willComplete = !task.completed;
        await updateDoc(taskRef, { completed: !task.completed, completedDays: !task.completed ? [...allDays] : [] });
        if (willComplete) await recordParentWeeklyStreak();
        return;
      }

      // Per-day toggle
      const currentCompleted = task.completedDays || [];
      const isDayDone = currentCompleted.includes(day);

      if (isDayDone) {
        // Unmark this day
        await updateDoc(taskRef, {
          completedDays: arrayRemove(day),
          completed: false
        });
      } else {
        // Mark this day done
        const newCompleted = [...currentCompleted, day];
        const allComplete = [...allDays].every(d => newCompleted.includes(d));
        await updateDoc(taskRef, {
          completedDays: arrayUnion(day),
          completed: allComplete
        });
        if (allComplete) await recordParentWeeklyStreak();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${ownerId}/children/${childId}/tasks/${task.id}`);
    }
  };

  const isDayCompleted = (task: Task, day: string) => {
    if (task.completed) return true;
    return task.completedDays?.includes(day) || false;
  };

  const handleGenerateStudyPlan = async () => {
    const incompleteTasks = tasks.filter(t => !t.completed);
    if (incompleteTasks.length === 0) return;
    setShowStudyPlan(true);
    setStudyPlanLoading(true);
    setStudyPlanContent(null);
    try {
      const content = await generateStudyPlan(
        incompleteTasks.map(t => ({
          subject: t.subject,
          description: t.description,
          dueDay: t.dueDay,
          workDays: t.workDays,
          minutesPerDay: t.minutesPerDay,
          completed: t.completed,
          completedDays: t.completedDays,
        }))
      );
      setStudyPlanContent(content);
    } catch (err) {
      console.error('Error generating study plan:', err);
      setStudyPlanContent('Kunde inte generera studieplan. Försök igen.');
    } finally {
      setStudyPlanLoading(false);
    }
  };

  const getLinkedChatContext = async (task: Task): Promise<string[]> => {
    if (!task.linkedChatSessionId || !auth.currentUser || !childId) return [];
    try {
      const q = query(
        collection(db, 'users', ownerId, 'children', childId, 'chatSessions', task.linkedChatSessionId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(8)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => d.data() as { role?: string; content?: string })
        .filter((m) => m.role === 'model' && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => (m.content as string).slice(0, 500))
        .reverse();
    } catch (err) {
      console.error('Error reading linked chat context:', err);
      return [];
    }
  };

  const handleExamPrep = async (task: Task, forceRegenerate = false) => {
    setExamPrepTask(task);
    setExamPrepLoading(true);
    setExamPrepContent(null);
    try {
      // Check if we already have cached content
      if (task.examPrepContent && !forceRegenerate) {
        setExamPrepContent(task.examPrepContent);
        setExamPrepLoading(false);
        return;
      }
      const linkedChatContext = await getLinkedChatContext(task);
      const content = await generateExamPrep(
        task.subject,
        task.description,
        task.aiNotes || [],
        linkedChatContext,
        getTaskImages(task)
      );
      setExamPrepContent(content);
      // Save to Firestore for caching
      await updateDoc(doc(db, 'users', ownerId, 'children', childId, 'tasks', task.id), {
        examPrepContent: content
      });
    } catch (err) {
      console.error('Error generating exam prep:', err);
      setExamPrepContent('Kunde inte generera provförberedelse. Försök igen.');
    } finally {
      setExamPrepLoading(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!auth.currentUser || !childId) return;
    try {
      await deleteDoc(doc(db, 'users', ownerId, 'children', childId, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${ownerId}/children/${childId}/tasks/${id}`);
    }
  };

  const moveTask = async (taskId: string, newDay: string) => {
    if (!auth.currentUser || !childId) return;
    try {
      await updateDoc(doc(db, 'users', ownerId, 'children', childId, 'tasks', taskId), {
        day: newDay
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${ownerId}/children/${childId}/tasks/${taskId}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) moveTask(taskId, day);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const toggleWorkDay = (day: string) => {
    setNewWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('matte') || s.includes('math')) return <Calculator size={14} />;
    if (s.includes('svenska') || s.includes('läs')) return <BookOpen size={14} />;
    if (s.includes('engelska') || s.includes('english')) return <Languages size={14} />;
    if (s.includes('no') || s.includes('science') || s.includes('fysik') || s.includes('kemi') || s.includes('biologi')) return <Beaker size={14} />;
    if (s.includes('so') || s.includes('historia') || s.includes('geografi')) return <Globe size={14} />;
    return <Book size={14} />;
  };

  const getTaskProgressPercent = (task: Task) => {
    if (typeof task.progressPercent === 'number') {
      return Math.max(0, Math.min(100, Math.round(task.progressPercent)));
    }
    return task.completed ? 100 : 0;
  };

  const getTaskRemainingPercent = (task: Task) => 100 - getTaskProgressPercent(task);
  const getTaskImages = (task: Task) => {
    if (task.imageUrls?.length) return task.imageUrls;
    if (task.imageUrl) return [task.imageUrl];
    return [];
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Get all tasks relevant to a specific day (work day, primary day, or due day)
  const getTasksForDay = (day: string) => {
    return tasks.filter(t => {
      // Direct match (the "day" field, backwards compatible)
      if (t.day === day) return true;
      // Also show if this day is in workDays
      if (t.workDays?.includes(day)) return true;
      // Also show on the inlämningsdag
      if (t.dueDay && t.dueDay === day) return true;
      return false;
    });
  };

  // Deduplicated tasks for day view (avoid showing same task twice)
  const getUniqueTasksForDay = (day: string) => {
    const dayTasks = getTasksForDay(day);
    const seen = new Set<string>();
    return dayTasks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      if (hideCompleted && isDayCompleted(t, day)) return false;
      return true;
    });
  };

  const TaskBadges = ({ task }: { task: Task }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {task.dateType === 'due' && task.workDays && task.workDays.length > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
          <Clock size={10} />
          Jobba: {task.workDays.map(d => d.slice(0, 3)).join(', ')}
        </span>
      )}
      {task.dateType === 'work' && task.dueDay && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
          <CalendarCheck size={10} />
          Inlämning: {task.dueDay.slice(0, 3)}
        </span>
      )}
      {task.dateType === 'due' && task.dueDay && task.day !== task.dueDay && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
          <CalendarCheck size={10} />
          Inlämning: {task.dueDay.slice(0, 3)}
        </span>
      )}
      {task.minutesPerDay && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
          <Clock size={10} />
          {task.minutesPerDay} min/dag
        </span>
      )}
    </div>
  );

  const [taskImages, setTaskImages] = useState<string[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Edit state for task detail modal
  const [editSubject, setEditSubject] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMinutesPerDay, setEditMinutesPerDay] = useState<number | ''>('');
  const [editProgressPercent, setEditProgressPercent] = useState<number | ''>('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editDueDay, setEditDueDay] = useState('');
  const [editWorkDays, setEditWorkDays] = useState<string[]>([]);
  const [editDateType, setEditDateType] = useState<'due' | 'work'>('due');
  const [showScheduleCalendar, setShowScheduleCalendar] = useState(false);
  const [editScheduleAnchorDate, setEditScheduleAnchorDate] = useState(() => new Date());

  const taskDueAnchorDate = (task: Task, fallbackYear: number, fallbackWeek: number) => {
    const y = task.year ?? fallbackYear;
    const w = task.weekNumber ?? fallbackWeek;
    const wd = (task.dueDay || task.day || 'måndag').toLowerCase();
    return getDateInPlannerWeek(y, w, wd);
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setEditSubject(task.subject || '');
    setEditDescription(task.description || '');
    setEditMinutesPerDay(task.minutesPerDay || '');
    setEditProgressPercent(getTaskProgressPercent(task));
    setEditImages(getTaskImages(task));
    setEditDueDay(task.dueDay || '');
    setEditWorkDays(task.workDays || []);
    setEditDateType(task.dateType || 'due');
    setEditScheduleAnchorDate(taskDueAnchorDate(task, viewYear, viewWeek));
    setShowScheduleCalendar(false);
  };

  const saveTaskEdits = async () => {
    if (!selectedTask || !auth.currentUser || !childId) return;
    try {
      const taskRef = doc(db, 'users', ownerId, 'children', childId, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        subject: editSubject.trim() || selectedTask.subject,
        description: editDescription,
        minutesPerDay: editMinutesPerDay === '' ? null : Number(editMinutesPerDay),
        progressPercent: editProgressPercent === ''
          ? getTaskProgressPercent(selectedTask)
          : Math.max(0, Math.min(100, Number(editProgressPercent))),
        imageUrls: editImages,
        imageUrl: editImages[0] || null,
        dueDay: editDueDay,
        workDays: editWorkDays,
        dateType: editDateType,
        day: editDateType === 'due' ? editDueDay : (editWorkDays[0] || selectedTask.day),
        weekNumber: getWeek(editScheduleAnchorDate, PLANNER_WEEK_OPTS),
        year: getYear(editScheduleAnchorDate),
      });
      setShowScheduleCalendar(false);
      setSelectedTask(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${selectedTask.id}`);
    }
  };

  const toggleEditWorkDay = (day: string) => {
    setEditWorkDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // Check if a task's due day matches a specific calendar day
  const isDueOnDay = (task: Task, day: string) => {
    return task.dueDay === day;
  };

  const processImages = async (files: FileList | null) => {
    if (!files?.length) return [];
    const all = Array.from(files);
    const results: string[] = [];
    for (const file of all) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      try {
        results.push(await compressImage(dataUrl, 800, 800, 0.7));
      } catch {
        results.push(dataUrl);
      }
    }
    return results;
  };

  const handlePlannerCamera = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const images = await processImages(e.target.files);
    if (images.length) setTaskImages(prev => [...prev, ...images]);
    e.target.value = '';
  };

  const handleEditTaskImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const images = await processImages(e.target.files);
    if (images.length) setEditImages(prev => [...prev, ...images]);
    e.target.value = '';
  };

  const renderFormFields = (inModal = false) => (
    <>
      {/* Camera button */}
      <button
        type="button"
        onClick={() => plannerCameraRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 rounded-xl font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
      >
        <Camera size={18} />
        Fota läxan
      </button>
      <input
        type="file"
        ref={plannerCameraRef}
        onChange={handlePlannerCamera}
        accept="image/*"
        multiple
        className="hidden"
      />
      {taskImages.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {taskImages.map((img, idx) => (
              <div key={`${idx}-${img.slice(0, 24)}`} className="relative">
                <img src={img} alt={`Läxbild ${idx + 1}`} className="w-full h-24 object-cover rounded-xl border border-black/5 dark:border-white/5" />
                <button
                  type="button"
                  onClick={() => setTaskImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 p-1 bg-white/90 dark:bg-slate-900/90 rounded-full text-stone-500 dark:text-stone-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Task type toggle */}
      <div className="flex bg-stone-100 dark:bg-slate-700 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setNewTaskType('homework')}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
            newTaskType === 'homework' ? "bg-white dark:bg-slate-900 shadow-sm text-emerald-700" : "text-stone-400 dark:text-stone-500"
          )}
        >
          {t('planner.typeHomework')}
        </button>
        <button
          type="button"
          onClick={() => setNewTaskType('exam')}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
            newTaskType === 'exam' ? "bg-purple-600 text-white shadow-sm" : "text-stone-400 dark:text-stone-500"
          )}
        >
          {t('planner.typeTest')}
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{t('planner.subject')}</label>
        <input
          type="text"
          autoFocus={inModal}
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="t.ex. Matematik"
          className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{t('planner.description')}</label>
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Vad ska göras?"
          rows={inModal ? 3 : 2}
          className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
        />
      </div>

      {/* Inlämningsdag (single select) */}
      <div>
        <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
          {t('planner.dueDate')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setNewDueDay(day)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
                newDueDay === day
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400"
                  : "bg-stone-50 dark:bg-slate-800 border-stone-100 dark:border-slate-700 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-700",
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Arbetsdagar (multi select) */}
      <div>
        <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
          {t('planner.workDays')}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWorkDay(day)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
                newWorkDays.includes(day)
                  ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400"
                  : "bg-stone-50 dark:bg-slate-800 border-stone-100 dark:border-slate-700 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-700"
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Minutes per day */}
      <div>
        <label className="block text-xs font-medium text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
          {t('planner.minutesPerDay')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={5}
            max={180}
            step={5}
            value={newMinutesPerDay}
            onChange={(e) => setNewMinutesPerDay(e.target.value ? Number(e.target.value) : '')}
            placeholder="t.ex. 30"
            className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
          <div className="flex gap-1">
            {[15, 30, 45, 60].map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setNewMinutesPerDay(m)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-xs font-medium transition-all border whitespace-nowrap",
                  newMinutesPerDay === m
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
                )}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-3xl font-serif italic mb-1 dark:text-stone-100">{t('planner.weeklyHomework')}</h2>
                <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                  <button
                    onClick={() => setViewDate(prev => subWeeks(prev, 1))}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium">Vecka {viewWeek}, {viewYear}</span>
                  <button
                    onClick={() => setViewDate(prev => addWeeks(prev, 1))}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                  {(viewWeek !== getWeek(new Date(), { weekStartsOn: 1, firstWeekContainsDate: 4 }) || viewYear !== getYear(new Date())) && (
                    <button
                      onClick={() => setViewDate(new Date())}
                      className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 hover:text-emerald-700 ml-2"
                    >
                      Idag
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleGenerateStudyPlan}
                disabled={tasks.filter(t => !t.completed).length === 0 || studyPlanLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                title="AI analyserar veckans uppgifter"
              >
                {studyPlanLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span className="hidden sm:inline">Smart planering</span>
              </button>
              <button
                onClick={() => setHideCompleted(!hideCompleted)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shadow-sm border",
                  hideCompleted
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-white dark:bg-slate-900 border-black/5 dark:border-white/5 text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-slate-800"
                )}
                title={hideCompleted ? "Visa klarmarkerade" : "Dölj klarmarkerade"}
              >
                {hideCompleted ? <EyeOff size={16} /> : <Eye size={16} />}
                <span className="hidden sm:inline">{hideCompleted ? 'Visa klarmarkerade' : 'Dölj klarmarkerade'}</span>
              </button>
              <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-black/5 dark:border-white/5">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'list' ? "bg-emerald-600 text-white shadow-sm" : "text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-slate-800"
                  )}
                  title="Listvy"
                >
                  <LayoutList size={20} />
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'calendar' ? "bg-emerald-600 text-white shadow-sm" : "text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-slate-800"
                  )}
                  title="Kalendervy"
                >
                  <Calendar size={20} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex bg-white dark:bg-slate-900 rounded-xl p-1 shadow-sm border border-black/5 dark:border-white/5 overflow-x-auto">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm capitalize transition-all whitespace-nowrap",
                  selectedDay === day ? "bg-emerald-600 text-white shadow-sm" : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800"
                )}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </header>

        {totalCount === 0 && (parentStreak?.currentStreakWeeks ?? 0) > 0 && (
          <div className="flex justify-end">
            <span
              className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 font-medium"
              title={t('planner.streakHint')}
            >
              <Flame size={12} className="text-amber-600/90 shrink-0" aria-hidden />
              {t('planner.streakWeeks', { count: parentStreak!.currentStreakWeeks })}
            </span>
          </div>
        )}

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Framsteg</span>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {(parentStreak?.currentStreakWeeks ?? 0) > 0 && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 font-medium"
                    title={t('planner.streakHint')}
                  >
                    <Flame size={12} className="text-amber-600/90 shrink-0" aria-hidden />
                    {t('planner.streakWeeks', { count: parentStreak!.currentStreakWeeks })}
                  </span>
                )}
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{completedCount} av {totalCount} klara ({Math.round(progress)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-stone-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/5 dark:border-white/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif italic flex items-center gap-2 dark:text-stone-100">
                  <Plus size={20} className="text-emerald-600" />
                  Lägg till läxa — <span className="capitalize">{selectedDay}</span>
                </h3>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-slate-700 rounded-full text-stone-400 dark:text-stone-500 transition-colors"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={addTask} className="space-y-5">
                {renderFormFields(true)}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="flex-1 py-4 bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-300 rounded-2xl font-medium hover:bg-stone-200 dark:hover:bg-slate-700 transition-all"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={!newSubject.trim()}
                    className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    Spara läxa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Add Task Form */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5 sticky top-8">
                <h3 className="font-medium mb-4 flex items-center gap-2 dark:text-stone-100">
                  <Plus size={18} className="text-emerald-600" />
                  Lägg till läxa — <span className="capitalize">{selectedDay}</span>
                </h3>
                <form onSubmit={addTask} className="space-y-4">
                  {renderFormFields(false)}
                  <button
                    type="submit"
                    disabled={!newSubject.trim()}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    Spara läxa
                  </button>
                </form>
              </div>
            </div>

            {/* Task List */}
            <div className="lg:col-span-2 space-y-6">
              {DAYS.map((day) => {
                const dayTasks = getUniqueTasksForDay(day);
                if (dayTasks.length === 0 && day !== selectedDay) return null;

                return (
                  <section key={day} className="space-y-3">
                    <h4 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                      {day}
                      <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
                    </h4>
                    <div className="space-y-1.5">
                      {dayTasks.length === 0 ? (
                        <div className="bg-white/50 dark:bg-slate-900/50 border border-dashed border-black/10 dark:border-white/10 rounded-xl p-6 text-center">
                          <p className="text-sm text-stone-400 dark:text-stone-500 italic">Inga läxor inlagda för {day}.</p>
                        </div>
                      ) : (
                        dayTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => openTaskDetail(task)}
                            className={cn(
                              "bg-white dark:bg-slate-900 rounded-xl px-3 py-2 shadow-sm border border-black/5 dark:border-white/5 transition-all group cursor-pointer hover:shadow-md",
                              isDayCompleted(task, day) && "opacity-60"
                            )}
                          >
                            <div className="grid grid-cols-[auto_minmax(140px,1.2fr)_80px_minmax(120px,1fr)_auto] gap-2 items-center w-full">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleTask(task, day); }}
                                className={cn(
                                  "shrink-0 transition-colors",
                                  isDayCompleted(task, day) ? "text-emerald-500" : "text-stone-300 hover:text-emerald-500"
                                )}
                              >
                                {isDayCompleted(task, day) ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                              </button>

                              <div className="min-w-0 flex items-center gap-2">
                                <div className={cn(
                                  "shrink-0 p-1 rounded-lg",
                                  isDayCompleted(task, day) ? "bg-stone-100 text-stone-400" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {getSubjectIcon(task.subject)}
                                </div>
                                <span className={cn(
                                  "font-medium text-sm truncate",
                                  isDayCompleted(task, day) && "line-through text-stone-400"
                                )}>
                                  {task.subject}
                                </span>
                              </div>

                              <div>
                                <span className={cn(
                                  "inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full uppercase",
                                  task.taskType === 'exam'
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-emerald-100 text-emerald-700"
                                )}>
                                  {task.taskType === 'exam' ? t('planner.typeTest') : t('planner.typeHomework')}
                                </span>
                              </div>

                              <div className="min-w-0">
                                {task.description ? (
                                  <span className="text-stone-400 text-sm truncate block">{task.description}</span>
                                ) : (
                                  <span className="text-stone-300 text-xs">-</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                {getTaskImages(task).length > 0 && (
                                  <ImageIcon size={14} className="text-amber-500" />
                                )}
                                {task.linkedChatSessionId && (
                                  <MessageSquare size={14} className="text-emerald-500" />
                                )}
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  {t('planner.remainingPercent', { value: getTaskRemainingPercent(task) })}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                  className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-black/5 dark:border-white/5 overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="grid grid-cols-7 gap-4 mb-6">
                {DAYS.map(day => (
                  <div key={day} className="text-center">
                    <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4 min-h-[400px]">
                {DAYS.map(day => {
                  const dayTasks = getUniqueTasksForDay(day);
                  return (
                    <div
                      key={day}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day)}
                      className="bg-stone-50/50 dark:bg-slate-800/50 rounded-2xl p-3 border border-black/5 dark:border-white/5 flex flex-col gap-2 min-h-[150px] transition-colors hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10"
                    >
                      {dayTasks.map(task => {
                        const isDeadline = isDueOnDay(task, day);
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => openTaskDetail(task)}
                            className={cn(
                              "p-3 rounded-xl text-xs shadow-sm border transition-all cursor-pointer hover:shadow-md",
                              isDayCompleted(task, day)
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700 opacity-60"
                                : task.taskType === 'exam'
                                  ? "bg-purple-50 border-purple-200 text-stone-700 ring-2 ring-purple-300/50"
                                  : isDeadline
                                    ? "bg-red-50 border-red-200 text-stone-700 ring-2 ring-red-300/50"
                                    : task.workDays?.includes(day)
                                      ? "bg-blue-50 border-blue-200 text-stone-700"
                                      : "bg-white dark:bg-slate-800 border-black/5 dark:border-white/5 text-stone-700 dark:text-stone-200"
                            )}
                          >
                            {task.taskType === 'exam' && isDeadline && !isDayCompleted(task, day) && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-purple-700 uppercase tracking-wider">
                                <CalendarCheck size={9} />
                                {t('planner.examDay')}
                              </div>
                            )}
                            {task.taskType === 'exam' && !isDeadline && !isDayCompleted(task, day) && task.workDays?.includes(day) && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                                <Clock size={9} />
                                {t('planner.workDay')}
                              </div>
                            )}
                            {task.taskType === 'exam' && !isDeadline && !isDayCompleted(task, day) && !task.workDays?.includes(day) && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-purple-600 uppercase tracking-wider">
                                <GraduationCap size={9} />
                                {t('planner.typeTest')}
                              </div>
                            )}
                            {task.taskType !== 'exam' && isDeadline && !isDayCompleted(task, day) && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-red-600 uppercase tracking-wider">
                                <CalendarCheck size={9} />
                                Inlämningsdag
                              </div>
                            )}
                            {task.taskType !== 'exam' && !isDeadline && !isDayCompleted(task, day) && task.workDays?.includes(day) && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                                <Clock size={9} />
                                Arbetsdag
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mb-1">
                              <div className="opacity-50">
                                {getSubjectIcon(task.subject)}
                              </div>
                              <div className="font-bold truncate">{task.subject}</div>
                            </div>
                            <div className="text-[10px] line-clamp-2 opacity-70">{task.description}</div>
                            {task.minutesPerDay && (
                              <div className="mt-1 text-[9px] text-emerald-600 flex items-center gap-0.5">
                                <Clock size={8} /> {task.minutesPerDay} min
                              </div>
                            )}
                            {task.dueDay && task.dueDay !== day && (
                              <div className={cn(
                                "mt-0.5 text-[9px] flex items-center gap-0.5",
                                task.taskType === 'exam' ? "text-purple-600" : "text-amber-600"
                              )}>
                                <CalendarCheck size={8} /> {task.taskType === 'exam' ? t('planner.examDay') : t('planner.submissionDay')}: {task.dueDay.slice(0, 3)}
                              </div>
                            )}
                            <div className="mt-1">
                              <div className="h-1.5 bg-stone-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-500 transition-all"
                                  style={{ width: `${getTaskProgressPercent(task)}%` }}
                                />
                              </div>
                              <div className="mt-0.5 text-[9px] text-indigo-600">
                                {t('planner.remainingPercent', { value: getTaskRemainingPercent(task) })}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleTask(task, day); }}
                                className={cn(
                                  "p-1 rounded-full transition-colors",
                                  isDayCompleted(task, day) ? "bg-emerald-200" : "bg-stone-100 hover:bg-emerald-100"
                                )}
                              >
                                {isDayCompleted(task, day) ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                              </button>
                              {task.taskType === 'exam' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleExamPrep(task); }}
                                  className="p-1 text-purple-400 hover:text-purple-600"
                                  title="Provförberedelse"
                                >
                                  <GraduationCap size={10} />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                className="p-1 text-stone-300 hover:text-red-500"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          setSelectedDay(day);
                          setShowAddModal(true);
                        }}
                        className={cn(
                          "w-full flex items-center justify-center rounded-xl border border-dashed border-black/10 transition-all hover:bg-emerald-50 hover:border-emerald-200 group",
                          dayTasks.length === 0 ? "flex-1 min-h-[100px]" : "py-2 mt-1"
                        )}
                      >
                        <Plus size={dayTasks.length === 0 ? 24 : 14} className="text-stone-300 group-hover:text-emerald-500" />
                        {dayTasks.length > 0 && <span className="text-[10px] ml-1 text-stone-400 group-hover:text-emerald-500">Lägg till</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => { setShowScheduleCalendar(false); setSelectedTask(null); }}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-black/5 dark:border-white/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    selectedTask.completed ? "bg-stone-100 dark:bg-slate-700 text-stone-400 dark:text-stone-500" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {getSubjectIcon(selectedTask.subject)}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic dark:text-stone-100">{selectedTask.subject}</h3>
                    <p className="text-xs text-stone-400 dark:text-stone-500 capitalize">{selectedTask.day}</p>
                  </div>
                </div>
                <button onClick={() => { setShowScheduleCalendar(false); setSelectedTask(null); }} className="p-2 hover:bg-stone-100 dark:hover:bg-slate-700 rounded-full text-stone-400 dark:text-stone-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Task images */}
              {editImages.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Foton av läxan</label>
                  <div className="grid grid-cols-2 gap-2">
                    {editImages.map((img, idx) => (
                      <div key={`${idx}-${img.slice(0, 24)}`} className="relative">
                        <img src={img} alt={`Läxbild ${idx + 1}`} className="w-full h-28 object-cover rounded-xl border border-black/5 dark:border-white/5 bg-stone-50 dark:bg-slate-800" />
                        <button
                          type="button"
                          onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-1 right-1 p-1 bg-white/90 dark:bg-slate-900/90 rounded-full text-stone-500 dark:text-stone-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <button
                  type="button"
                  onClick={() => editTaskCameraRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30 rounded-xl font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all"
                >
                  <Camera size={16} />
                  Lägg till fler bilder
                </button>
                <input
                  type="file"
                  ref={editTaskCameraRef}
                  onChange={handleEditTaskImages}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              {/* Editable: Subject */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                  {t('planner.subject')}
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="t.ex. Matematik"
                  className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>

              {/* Editable: Description */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                  {t('planner.description')}
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Vad ska göras?"
                  rows={3}
                  className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                />
              </div>

              {/* Editable: Minutes per day */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                  {t('planner.minutesPerDay')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    value={editMinutesPerDay}
                    onChange={(e) => setEditMinutesPerDay(e.target.value ? Number(e.target.value) : '')}
                    placeholder="t.ex. 30"
                    className="w-full bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm dark:text-stone-100 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                  <div className="flex gap-1">
                    {[15, 30, 45, 60].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setEditMinutesPerDay(m)}
                        className={cn(
                          "px-2.5 py-2 rounded-lg text-xs font-medium transition-all border whitespace-nowrap",
                          editMinutesPerDay === m
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
                        )}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Editable: Task progress */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">
                  {t('planner.masteryPercent')}
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={editProgressPercent === '' ? 0 : editProgressPercent}
                    onChange={(e) => setEditProgressPercent(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={editProgressPercent}
                      onChange={(e) => setEditProgressPercent(e.target.value ? Number(e.target.value) : '')}
                      className="w-24 bg-stone-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-sm dark:text-stone-100 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <span className="text-sm text-stone-500">%</span>
                    <span className="text-sm text-indigo-600 ml-auto">
                      {t('planner.remainingPercent', {
                        value: 100 - (editProgressPercent === '' ? 0 : Number(editProgressPercent))
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Editable: Due day / Exam day */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                  {selectedTask.taskType === 'exam' ? t('planner.examDay') : t('planner.submissionDay')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowScheduleCalendar(true)}
                  className="mb-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-200 dark:border-slate-600 bg-stone-50 dark:bg-slate-800 text-stone-700 dark:text-stone-200 text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <CalendarIcon size={18} />
                  {t('planner.pickDateInCalendar')}
                </button>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                  {t('planner.scheduleCalendarSelected', {
                    week: getWeek(editScheduleAnchorDate, PLANNER_WEEK_OPTS),
                    year: getYear(editScheduleAnchorDate),
                    day: format(editScheduleAnchorDate, 'EEEE d MMMM', { locale: sv }),
                  })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setEditDueDay(day);
                        setEditScheduleAnchorDate(
                          getDateInPlannerWeek(
                            getYear(editScheduleAnchorDate),
                            getWeek(editScheduleAnchorDate, PLANNER_WEEK_OPTS),
                            day
                          )
                        );
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
                        editDueDay === day
                          ? selectedTask.taskType === 'exam'
                            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400 ring-1 ring-purple-300 dark:ring-purple-800"
                            : "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-800"
                          : "bg-stone-50 dark:bg-slate-800 border-stone-100 dark:border-slate-700 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-700"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable: Arbetsdagar */}
              <div>
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                  Arbetsdagar
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleEditWorkDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
                        editWorkDays.includes(day)
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                          : "bg-stone-50 dark:bg-slate-800 border-stone-100 dark:border-slate-700 text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-700"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Notes */}
              {selectedTask.aiNotes && selectedTask.aiNotes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">AI-anteckningar</label>
                  <div className="space-y-2">
                    {selectedTask.aiNotes.map((note, i) => (
                      <div key={i} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800">
                        {note.length > 200 ? note.slice(0, 200) + '...' : note}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {/* Save edits button - only show if something changed */}
                {(
                  editSubject.trim() !== (selectedTask.subject || '') ||
                  editDescription !== (selectedTask.description || '') ||
                  editMinutesPerDay !== (selectedTask.minutesPerDay || '') ||
                  editProgressPercent !== getTaskProgressPercent(selectedTask) ||
                  editDueDay !== (selectedTask.dueDay || '') ||
                  JSON.stringify(editWorkDays) !== JSON.stringify(selectedTask.workDays || []) ||
                  JSON.stringify(editImages) !== JSON.stringify(getTaskImages(selectedTask)) ||
                  !isSameDay(
                    editScheduleAnchorDate,
                    taskDueAnchorDate(selectedTask, viewYear, viewWeek)
                  )
                ) && (
                  <button
                    onClick={saveTaskEdits}
                    disabled={!editSubject.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                  >
                    <CalendarCheck size={18} />
                    Spara ändringar
                  </button>
                )}

                {onOpenAiForTask && (
                  <button
                    onClick={() => {
                      const urls = editImages.slice(0, 5);
                      onOpenAiForTask(
                        selectedTask.id,
                        selectedTask.subject,
                        selectedTask.description,
                        urls.length ? urls : undefined
                      );
                      setSelectedTask(null);
                      setShowScheduleCalendar(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
                  >
                    <MessageSquare size={18} />
                    Fråga AI om denna läxa
                  </button>
                )}
                {selectedTask.taskType === 'exam' && (
                  <button
                    onClick={() => handleExamPrep(selectedTask)}
                    className="w-full py-3 bg-purple-50 border border-purple-200 text-purple-700 rounded-2xl font-medium hover:bg-purple-100 transition-all flex items-center justify-center gap-2"
                  >
                    <GraduationCap size={18} />
                    Skapa provförberedelse med AI
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { toggleTask(selectedTask); setSelectedTask({ ...selectedTask, completed: !selectedTask.completed }); }}
                    className={cn(
                      "flex-1 py-3 rounded-2xl font-medium transition-all border",
                      selectedTask.completed
                        ? "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    {selectedTask.completed ? 'Markera som ej klar' : 'Markera som klar'}
                  </button>
                  <button
                    onClick={() => { deleteTask(selectedTask.id); setShowScheduleCalendar(false); setSelectedTask(null); }}
                    className="py-3 px-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl font-medium hover:bg-red-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showStudyPlan && (
        <StudyPlanModal
          content={studyPlanContent}
          loading={studyPlanLoading}
          onClose={() => setShowStudyPlan(false)}
        />
      )}
      {examPrepTask && (
        <ExamPrepModal
          content={examPrepContent}
          subject={examPrepTask.subject}
          loading={examPrepLoading}
          onRegenerate={() => handleExamPrep(examPrepTask, true)}
          onClose={() => { setExamPrepTask(null); setExamPrepContent(null); }}
        />
      )}
      <ScheduleCalendarModal
        open={Boolean(selectedTask) && showScheduleCalendar}
        initialDate={editScheduleAnchorDate}
        onClose={() => setShowScheduleCalendar(false)}
        onConfirm={(d) => {
          setEditScheduleAnchorDate(d);
          setEditDueDay(format(d, 'EEEE', { locale: sv }).toLowerCase());
          setShowScheduleCalendar(false);
        }}
      />
    </div>
  );
}
