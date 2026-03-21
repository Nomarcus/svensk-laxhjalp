import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutList, Calendar, Calculator, BookOpen, Languages, Beaker, Globe, Book, Clock, CalendarCheck, Camera, MessageSquare, X, Image as ImageIcon } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { format, startOfWeek, addDays, getWeek, getYear, addWeeks, subWeeks } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '../utils/cn';
import { compressImage } from '../utils/image';
import type { Task } from '../types';

interface PlannerProps {
  childId: string;
  ownerId: string;
  prefill?: { subject: string; description: string } | null;
  onPrefillUsed?: () => void;
  onOpenAiForTask?: (taskId: string, subject: string, description: string, imageUrl?: string) => void;
}

const DAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];

export default function Planner({ childId, ownerId, prefill, onPrefillUsed, onOpenAiForTask }: PlannerProps) {
  const plannerCameraRef = useRef<HTMLInputElement>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'EEEE', { locale: sv }));
  const [showAddModal, setShowAddModal] = useState(false);

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

  const resetForm = () => {
    setNewSubject('');
    setNewDesc('');
    setNewDateType('due');
    setNewWorkDays([]);
    setNewDueDay('');
    setNewMinutesPerDay('');
    setTaskImage(null);
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
        createdAt: new Date().toISOString()
      };

      if (newMinutesPerDay) {
        taskData.minutesPerDay = Number(newMinutesPerDay);
      }
      if (taskImage) {
        taskData.imageUrl = taskImage;
      }

      if (newDateType === 'due') {
        // selectedDay = inlämningsdag, workDays = vilka dagar barnet ska jobba
        taskData.dueDay = selectedDay;
        taskData.workDays = newWorkDays.length > 0 ? newWorkDays : [];
      } else {
        // selectedDay = arbetsdag, dueDay = när ska det lämnas in
        taskData.dueDay = newDueDay || '';
        taskData.workDays = [selectedDay];
      }

      await addDoc(collection(db, 'users', ownerId, 'children', childId, 'tasks'), taskData);

      resetForm();
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${ownerId}/children/${childId}/tasks`);
    }
  };

  const toggleTask = async (task: Task) => {
    if (!auth.currentUser || !childId) return;
    try {
      await updateDoc(doc(db, 'users', ownerId, 'children', childId, 'tasks', task.id), {
        completed: !task.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${ownerId}/children/${childId}/tasks/${task.id}`);
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
      // Also show on the due/deadline day
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

  const [taskImage, setTaskImage] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Edit state for task detail modal
  const [editDueDay, setEditDueDay] = useState('');
  const [editWorkDays, setEditWorkDays] = useState<string[]>([]);
  const [editDateType, setEditDateType] = useState<'due' | 'work'>('due');

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setEditDueDay(task.dueDay || '');
    setEditWorkDays(task.workDays || []);
    setEditDateType(task.dateType || 'due');
  };

  const saveTaskEdits = async () => {
    if (!selectedTask || !auth.currentUser || !childId) return;
    try {
      const taskRef = doc(db, 'users', ownerId, 'children', childId, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        dueDay: editDueDay,
        workDays: editWorkDays,
        dateType: editDateType,
        day: editDateType === 'due' ? editDueDay : (editWorkDays[0] || selectedTask.day),
      });
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

  const handlePlannerCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result as string, 800, 800, 0.7);
        setTaskImage(compressed);
      } catch {
        setTaskImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const renderFormFields = (inModal = false) => (
    <>
      {/* Camera button */}
      <button
        type="button"
        onClick={() => plannerCameraRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl font-medium hover:bg-amber-100 transition-all"
      >
        <Camera size={18} />
        Fota läxan
      </button>
      <input
        type="file"
        ref={plannerCameraRef}
        onChange={handlePlannerCamera}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
      {taskImage && (
        <div className="relative">
          <img src={taskImage} alt="Läxbild" className="w-full max-h-40 object-cover rounded-xl border border-black/5" />
          <button type="button" onClick={() => setTaskImage(null)} className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-stone-500 hover:text-red-500">✕</button>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">Ämne</label>
        <input
          type="text"
          autoFocus={inModal}
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="t.ex. Matematik"
          className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">Beskrivning</label>
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Vad ska göras?"
          rows={inModal ? 3 : 2}
          className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
        />
      </div>

      {/* Date type selector */}
      <div>
        <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
          Vad betyder {selectedDay}?
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setNewDateType('due')}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all border",
              newDateType === 'due'
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
            )}
          >
            Inlämningsdag
          </button>
          <button
            type="button"
            onClick={() => setNewDateType('work')}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all border",
              newDateType === 'work'
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
            )}
          >
            Arbetsdag
          </button>
        </div>
      </div>

      {/* Work days picker (multi select) when dateType is 'due' — selectedDay is the deadline, pick which days to work */}
      {newDateType === 'due' && (
        <div>
          <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
            Vilka dagar ska barnet jobba med läxan?
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
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
                )}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Due day picker (single select) when dateType is 'work' — selectedDay is a work day, pick the deadline */}
      {newDateType === 'work' && (
        <div>
          <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">
            Vilken dag ska det lämnas in?
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
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100",
                )}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Minutes per day */}
      <div>
        <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">
          Tid per dag (minuter)
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
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0]">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-3xl font-serif italic mb-1">Veckans Läxor</h2>
                <div className="flex items-center gap-2 text-stone-500">
                  <button
                    onClick={() => setViewDate(prev => subWeeks(prev, 1))}
                    className="p-1 hover:bg-stone-200 rounded-full transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium">Vecka {viewWeek}, {viewYear}</span>
                  <button
                    onClick={() => setViewDate(prev => addWeeks(prev, 1))}
                    className="p-1 hover:bg-stone-200 rounded-full transition-colors"
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
            <div className="flex bg-white rounded-xl p-1 shadow-sm border border-black/5 ml-4">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'list' ? "bg-emerald-600 text-white shadow-sm" : "text-stone-400 hover:bg-stone-50"
                )}
                title="Listvy"
              >
                <LayoutList size={20} />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  viewMode === 'calendar' ? "bg-emerald-600 text-white shadow-sm" : "text-stone-400 hover:bg-stone-50"
                )}
                title="Kalendervy"
              >
                <Calendar size={20} />
              </button>
            </div>
          </div>
          <div className="flex bg-white rounded-xl p-1 shadow-sm border border-black/5 overflow-x-auto">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm capitalize transition-all whitespace-nowrap",
                  selectedDay === day ? "bg-emerald-600 text-white shadow-sm" : "text-stone-500 hover:bg-stone-50"
                )}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </header>

        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Framsteg</span>
              <span className="text-xs font-bold text-emerald-600">{completedCount} av {totalCount} klara ({Math.round(progress)}%)</span>
            </div>
            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
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
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif italic flex items-center gap-2">
                  <Plus size={20} className="text-emerald-600" />
                  Lägg till läxa — <span className="capitalize">{selectedDay}</span>
                </h3>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
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
                    className="flex-1 py-4 bg-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-200 transition-all"
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
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5 sticky top-8">
                <h3 className="font-medium mb-4 flex items-center gap-2">
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
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                      {day}
                      <div className="h-px flex-1 bg-black/5" />
                    </h4>
                    <div className="space-y-1.5">
                      {dayTasks.length === 0 ? (
                        <div className="bg-white/50 border border-dashed border-black/10 rounded-xl p-6 text-center">
                          <p className="text-sm text-stone-400 italic">Inga läxor inlagda för {day}.</p>
                        </div>
                      ) : (
                        dayTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => openTaskDetail(task)}
                            className={cn(
                              "bg-white rounded-xl px-3 py-2 shadow-sm border border-black/5 flex items-center gap-3 transition-all group cursor-pointer hover:shadow-md",
                              task.completed && "opacity-60"
                            )}
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                              className={cn(
                                "shrink-0 transition-colors",
                                task.completed ? "text-emerald-500" : "text-stone-300 hover:text-emerald-500"
                              )}
                            >
                              {task.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                            </button>
                            <div className={cn(
                              "shrink-0 p-1 rounded-lg",
                              task.completed ? "bg-stone-100 text-stone-400" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {getSubjectIcon(task.subject)}
                            </div>
                            <span className={cn(
                              "font-medium text-sm shrink-0",
                              task.completed && "line-through text-stone-400"
                            )}>
                              {task.subject}
                            </span>
                            {task.description && (
                              <span className="text-stone-400 text-sm truncate min-w-0">
                                {task.description}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto shrink-0">
                              {task.imageUrl && (
                                <ImageIcon size={14} className="text-amber-500" />
                              )}
                              {task.linkedChatSessionId && (
                                <MessageSquare size={14} className="text-emerald-500" />
                              )}
                              {task.dateType === 'due' && task.dueDay && task.day !== task.dueDay && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  {task.dueDay.slice(0, 3)}
                                </span>
                              )}
                              {task.dateType === 'work' && task.dueDay && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  Inl: {task.dueDay.slice(0, 3)}
                                </span>
                              )}
                              {task.minutesPerDay && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                  {task.minutesPerDay}min
                                </span>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                className="p-1 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
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
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="grid grid-cols-7 gap-4 mb-6">
                {DAYS.map(day => (
                  <div key={day} className="text-center">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{day.slice(0, 3)}</span>
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
                      className="bg-stone-50/50 rounded-2xl p-3 border border-black/5 flex flex-col gap-2 min-h-[150px] transition-colors hover:bg-emerald-50/30"
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
                              task.completed
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700 opacity-60"
                                : isDeadline
                                  ? "bg-red-50 border-red-200 text-stone-700 ring-2 ring-red-300/50"
                                  : "bg-white border-black/5 text-stone-700"
                            )}
                          >
                            {isDeadline && !task.completed && (
                              <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-red-600 uppercase tracking-wider">
                                <CalendarCheck size={9} />
                                Deadline
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
                              <div className="mt-0.5 text-[9px] text-amber-600 flex items-center gap-0.5">
                                <CalendarCheck size={8} /> Inl: {task.dueDay.slice(0, 3)}
                              </div>
                            )}
                            <div className="mt-2 flex items-center justify-between">
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleTask(task); }}
                                className={cn(
                                  "p-1 rounded-full transition-colors",
                                  task.completed ? "bg-emerald-200" : "bg-stone-100 hover:bg-emerald-100"
                                )}
                              >
                                {task.completed ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                              </button>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    selectedTask.completed ? "bg-stone-100 text-stone-400" : "bg-emerald-50 text-emerald-600"
                  )}>
                    {getSubjectIcon(selectedTask.subject)}
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic">{selectedTask.subject}</h3>
                    <p className="text-xs text-stone-400 capitalize">{selectedTask.day}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Task image */}
              {selectedTask.imageUrl && (
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Foto av läxan</label>
                  <img src={selectedTask.imageUrl} alt="Läxbild" className="w-full max-h-64 object-contain rounded-xl border border-black/5 bg-stone-50" />
                </div>
              )}

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Beskrivning</label>
                  <p className="text-sm text-stone-600 leading-relaxed">{selectedTask.description}</p>
                </div>
              )}

              {/* Editable: Inlämningsdag */}
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
                  Inlämningsdag (deadline)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setEditDueDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize",
                        editDueDay === day
                          ? "bg-red-50 border-red-300 text-red-700 ring-1 ring-red-300"
                          : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable: Arbetsdagar */}
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
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
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-stone-50 border-stone-100 text-stone-400 hover:bg-stone-100"
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
                  <label className="block text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">AI-anteckningar</label>
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
                {(editDueDay !== (selectedTask.dueDay || '') || JSON.stringify(editWorkDays) !== JSON.stringify(selectedTask.workDays || [])) && (
                  <button
                    onClick={saveTaskEdits}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-medium shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
                  >
                    <CalendarCheck size={18} />
                    Spara ändringar
                  </button>
                )}

                {onOpenAiForTask && (
                  <button
                    onClick={() => {
                      onOpenAiForTask(selectedTask.id, selectedTask.subject, selectedTask.description, selectedTask.imageUrl);
                      setSelectedTask(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
                  >
                    <MessageSquare size={18} />
                    Fråga AI om denna läxa
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
                    onClick={() => { deleteTask(selectedTask.id); setSelectedTask(null); }}
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
    </div>
  );
}
