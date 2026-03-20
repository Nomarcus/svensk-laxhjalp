import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutList, Calendar, Calculator, BookOpen, Languages, Beaker, Globe, Book } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { format, startOfWeek, addDays, getWeek, getYear, addWeeks, subWeeks } from 'date-fns';
import { sv } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  day: string;
  subject: string;
  description: string;
  completed: boolean;
}

interface PlannerProps {
  childId: string;
  ownerId: string;
}

export default function Planner({ childId, ownerId }: PlannerProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [newSubject, setNewSubject] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'EEEE', { locale: sv }));
  const [showAddModal, setShowAddModal] = useState(false);
  
  const viewWeek = getWeek(viewDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const viewYear = getYear(viewDate);

  const days = [
    'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'
  ];

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

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !auth.currentUser || !childId) return;

    try {
      const newTask = {
        day: selectedDay,
        subject: newSubject,
        description: newDesc,
        completed: false
      };

      await addDoc(collection(db, 'users', ownerId, 'children', childId, 'tasks'), {
        ...newTask,
        weekNumber: viewWeek,
        year: viewYear,
        createdAt: new Date().toISOString()
      });

      setNewSubject('');
      setNewDesc('');
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
    if (taskId) {
      moveTask(taskId, day);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

  const completedCount = tasks.length > 0 ? tasks.filter(t => t.completed).length : 0;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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
            {days.map((day) => (
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
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif italic flex items-center gap-2">
                  <Plus size={20} className="text-emerald-600" />
                  Lägg till läxa för {selectedDay}
                </h3>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors"
                >
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>
              <form onSubmit={addTask} className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">Ämne</label>
                  <input
                    type="text"
                    autoFocus
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    placeholder="t.ex. Matematik"
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-2">Beskrivning</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Vad ska göras?"
                    rows={4}
                    className="w-full bg-stone-50 border-none rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
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
                  Lägg till läxa
                </h3>
                <form onSubmit={addTask} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-400 uppercase tracking-widest mb-1">Ämne</label>
                    <input
                      type="text"
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
                      rows={3}
                      className="w-full bg-stone-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                    />
                  </div>
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
              {days.map((day) => {
                const dayTasks = tasks.filter(t => t.day === day);
                if (dayTasks.length === 0 && day !== selectedDay) return null;

                return (
                  <section key={day} className="space-y-3">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                      {day}
                      <div className="h-px flex-1 bg-black/5" />
                    </h4>
                    <div className="space-y-3">
                      {dayTasks.length === 0 ? (
                        <div className="bg-white/50 border border-dashed border-black/10 rounded-2xl p-8 text-center">
                          <p className="text-sm text-stone-400 italic">Inga läxor inlagda för {day}.</p>
                        </div>
                      ) : (
                        dayTasks.map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              "bg-white rounded-2xl p-4 shadow-sm border border-black/5 flex items-start gap-4 transition-all group",
                              task.completed && "opacity-60"
                            )}
                          >
                            <button
                              onClick={() => toggleTask(task)}
                              className={cn(
                                "mt-1 transition-colors",
                                task.completed ? "text-emerald-500" : "text-stone-300 hover:text-emerald-500"
                              )}
                            >
                              {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "p-1.5 rounded-lg",
                                  task.completed ? "bg-stone-100 text-stone-400" : "bg-emerald-50 text-emerald-600"
                                )}>
                                  {getSubjectIcon(task.subject)}
                                </div>
                                <h5 className={cn(
                                  "font-medium text-lg",
                                  task.completed && "line-through text-stone-400"
                                )}>
                                  {task.subject}
                                </h5>
                              </div>
                              <p className="text-stone-500 text-sm mt-1">{task.description}</p>
                            </div>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
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
                {days.map(day => (
                  <div key={day} className="text-center">
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{day.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4 min-h-[400px]">
                {days.map(day => {
                  const dayTasks = tasks.filter(t => t.day === day);
                  return (
                    <div 
                      key={day} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, day)}
                      className="bg-stone-50/50 rounded-2xl p-3 border border-black/5 flex flex-col gap-2 min-h-[150px] transition-colors hover:bg-emerald-50/30"
                    >
                      {dayTasks.map(task => (
                        <div 
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          className={cn(
                            "p-3 rounded-xl text-xs shadow-sm border transition-all cursor-grab active:cursor-grabbing",
                            task.completed 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700 opacity-60" 
                              : "bg-white border-black/5 text-stone-700"
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="opacity-50">
                              {getSubjectIcon(task.subject)}
                            </div>
                            <div className="font-bold truncate">{task.subject}</div>
                          </div>
                          <div className="text-[10px] line-clamp-2 opacity-70">{task.description}</div>
                          <div className="mt-2 flex items-center justify-between">
                            <button 
                              onClick={() => toggleTask(task)}
                              className={cn(
                                "p-1 rounded-full transition-colors",
                                task.completed ? "bg-emerald-200" : "bg-stone-100 hover:bg-emerald-100"
                              )}
                            >
                              {task.completed ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                            </button>
                            <button 
                              onClick={() => deleteTask(task.id)}
                              className="p-1 text-stone-300 hover:text-red-500"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
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
    </div>
  );
}
