import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Loader2, Bot, X, Calculator, BookOpen, Languages, Beaker, Globe, Book, Check } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { generateHomeworkHelp, generateImage } from '../services/geminiService';
import { compressImage } from '../utils/image';
import { cn } from '../utils/cn';
import type { Message, ChatSession, Task } from '../types';
import ChatHeader from './chat/ChatHeader';
import ChatMessage from './chat/ChatMessage';
import ChatInput from './chat/ChatInput';
import ChatEmptyState from './chat/ChatEmptyState';

interface ChatProps {
  childId: string;
  childName: string;
  ownerId: string;
  tasks?: Task[];
  taskContext?: { taskId: string; subject: string; description: string; imageUrl?: string } | null;
  onTaskContextUsed?: () => void;
}

export default function Chat({ childId, childName, ownerId, tasks = [], taskContext, onTaskContextUsed }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [taskPickerContent, setTaskPickerContent] = useState<string | null>(null);
  const [linkedTaskIds, setLinkedTaskIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser || !childId) return;
    const sessionsRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ChatSession[];
      setSessions(data);
      if (data.length > 0) {
        if (!activeSessionId || !data.find(s => s.id === activeSessionId)) {
          setActiveSessionId(data[0].id);
        }
      } else {
        createNewSession();
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'chatSessions'));

    return () => unsubscribe();
  }, [childId, activeSessionId]);

  useEffect(() => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    const q = query(
      collection(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'messages'));

    return () => unsubscribe();
  }, [childId, activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle task context from planner - auto-send question about the task
  const taskContextProcessed = useRef(false);
  useEffect(() => {
    if (taskContext && activeSessionId && !loading && !taskContextProcessed.current) {
      taskContextProcessed.current = true;
      const prompt = `Jag behöver hjälp med denna läxa:\n\nÄmne: ${taskContext.subject}\n${taskContext.description ? `Beskrivning: ${taskContext.description}\n` : ''}Förklara vad uppgiften handlar om och ge tips på hur jag som förälder kan hjälpa mitt barn.`;

      if (taskContext.imageUrl) {
        setImage(taskContext.imageUrl);
      }

      // Small delay to ensure session is ready
      setTimeout(() => {
        sendMessage(prompt);
        onTaskContextUsed?.();
      }, 500);
    }
    if (!taskContext) {
      taskContextProcessed.current = false;
    }
  }, [taskContext, activeSessionId]);

  const createNewSession = async () => {
    if (!auth.currentUser || !childId) return;
    try {
      const ref = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
      const docRef = await addDoc(ref, { title: `Chatt ${new Date().toLocaleDateString()}`, createdAt: serverTimestamp() });
      setActiveSessionId(docRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions');
    }
  };

  const clearChat = async () => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    if (!window.confirm('Är du säker på att du vill rensa denna chatt?')) return;
    try {
      await deleteDoc(doc(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId));
      setActiveSessionId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chatSessions/${activeSessionId}`);
    }
  };

  const saveToLibrary = async (message: Message) => {
    if (!auth.currentUser || !childId) return;
    try {
      const libraryRef = collection(db, 'users', ownerId, 'children', childId, 'library');
      await addDoc(libraryRef, {
        title: message.content.split('\n')[0].replace(/[#*]/g, '').slice(0, 50) || 'Sparad förklaring',
        content: message.content,
        type: message.generatedImage ? 'image' : 'text',
        imageUrl: message.generatedImage || null,
        createdAt: serverTimestamp(),
        subject: 'Allmänt',
      });
      setSavedMessageIds(prev => new Set(prev).add(message.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'library');
    }
  };

  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('matte') || s.includes('math')) return <Calculator size={14} />;
    if (s.includes('svenska') || s.includes('läs')) return <BookOpen size={14} />;
    if (s.includes('engelska') || s.includes('english')) return <Languages size={14} />;
    if (s.includes('no') || s.includes('fysik') || s.includes('kemi') || s.includes('biologi')) return <Beaker size={14} />;
    if (s.includes('so') || s.includes('historia') || s.includes('geografi')) return <Globe size={14} />;
    return <Book size={14} />;
  };

  const saveNoteToTask = async (taskId: string, content: string) => {
    if (!auth.currentUser || !childId) return;
    try {
      const taskRef = doc(db, 'users', ownerId, 'children', childId, 'tasks', taskId);
      const note = content.length > 500 ? content.slice(0, 500) + '...' : content;
      await updateDoc(taskRef, {
        aiNotes: arrayUnion(note),
        linkedChatSessionId: activeSessionId,
      });
      setLinkedTaskIds(prev => new Set(prev).add(taskId));
      setTaskPickerContent(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleShare = async (message: Message) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Läxhjälp Förklaring', text: message.content, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(message.content);
        alert('Text kopierad till urklipp!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleGenerateImage = async (messageId: string, content: string) => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    setGeneratingImageId(messageId);
    const path = `users/${ownerId}/children/${childId}/chatSessions/${activeSessionId}/messages/${messageId}`;
    try {
      const imageUrl = await generateImage(content);
      if (imageUrl) {
        const compressed = await compressImage(imageUrl, 800, 800, 0.6);
        await updateDoc(doc(db, path), { generatedImage: compressed });
      }
    } catch (err) {
      console.error('Error generating image:', err);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const sendMessage = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const messageText = typeof e === 'string' ? e : input.trim();
    if ((!messageText && !image) || loading || !auth.currentUser || !childId || !activeSessionId) return;

    const currentImage = image;
    if (typeof e !== 'string') setInput('');
    setImage(null);
    setLoading(true);
    setError(null);

    try {
      const messagesRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages');

      try {
        await addDoc(messagesRef, {
          role: 'user',
          content: messageText || 'Analysera denna bild.',
          timestamp: serverTimestamp(),
          attachments: currentImage ? [currentImage] : [],
        });
      } catch (err: any) {
        if (err.message?.includes('exceeds the maximum allowed size')) {
          await addDoc(messagesRef, {
            role: 'user',
            content: (messageText || 'Analysera denna bild.') + ' (Bilden var för stor för att sparas i historiken)',
            timestamp: serverTimestamp(),
            attachments: [],
          });
        } else {
          handleFirestoreError(err, OperationType.CREATE, 'messages');
        }
      }

      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await generateHomeworkHelp(
        messageText || 'Analysera denna bild.',
        history,
        currentImage?.split(',')[1]
      );

      await addDoc(messagesRef, { role: 'model', content: response, timestamp: serverTimestamp() });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Uppgradera') || msg.includes('Pro-abonnemang') || msg.includes('gratis')) {
        setError(`${msg} 👉 Gå till Abonnemang för att uppgradera.`);
      } else if (msg.includes('RESOURCE_EXHAUSTED')) {
        setError('AI-tjänsten är tillfälligt överbelastad. Vänta en stund och försök igen.');
      } else {
        setError(msg || 'Ett oväntat fel uppstod. Försök igen senare.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col h-full bg-white md:bg-transparent relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const compressed = await compressImage(reader.result as string);
              setImage(compressed);
            } catch (err) {
              console.error('Error processing dropped image:', err);
            }
          };
          reader.readAsDataURL(file);
        }
      }}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-600/10 backdrop-blur-[2px] z-50 flex items-center justify-center border-4 border-dashed border-emerald-600 m-4 rounded-3xl pointer-events-none">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <ImageIcon size={32} />
            </div>
            <h3 className="text-xl font-serif italic text-emerald-900">Släpp bilden här</h3>
            <p className="text-emerald-600/60 text-sm">för att analysera läxan</p>
          </div>
        </div>
      )}

      <ChatHeader
        childName={childName}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={createNewSession}
        onClearChat={clearChat}
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {error && (
          <div className="max-w-3xl mx-auto mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {messages.length === 0 && !loading ? (
          <ChatEmptyState childName={childName} onSendStarter={sendMessage} />
        ) : (
          messages.map((msg, idx) => {
            // Check if the user message before this AI response had an image
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const hasImage = msg.role === 'model' && prevMsg?.role === 'user' && (prevMsg.attachments?.length ?? 0) > 0;

            return (
              <ChatMessage
                key={msg.id}
                msg={msg}
                generatingImageId={generatingImageId}
                savedMessageIds={savedMessageIds}
                onShare={handleShare}
                onSaveToLibrary={saveToLibrary}
                onGenerateImage={handleGenerateImage}
                onAskCurriculum={(content) => {
                  sendMessage(`Förklara hur det du just berättade om kopplas till den svenska läroplanen (Lgr22). Vilka centrala innehåll och kunskapskrav berörs? Ge konkreta kopplingar så jag som förälder förstår varför mitt barn lär sig detta.\n\nDin förklaring var:\n${content.slice(0, 500)}`);
                }}
                hasImage={hasImage}
                onAddToPlanner={tasks.length > 0 ? (content) => {
                  setTaskPickerContent(content);
                } : undefined}
              />
            );
          })
        )}

        {loading && (
          <div className="flex gap-4 mr-auto">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Bot size={16} />
            </div>
            <div className="bg-white border border-black/5 shadow-sm rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-emerald-600" />
              <span className="text-sm text-stone-500 italic">Tänker...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        image={image}
        setImage={setImage}
        loading={loading}
        onSubmit={sendMessage}
      />

      {/* Task Picker Modal */}
      {taskPickerContent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setTaskPickerContent(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic">Koppla till en läxa</h3>
                <button onClick={() => setTaskPickerContent(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-stone-500 mt-1">Välj vilken läxa du vill spara AI-svaret till</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tasks.filter(t => !t.completed).length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8 italic">Inga aktiva läxor att koppla till.</p>
              ) : (
                tasks.filter(t => !t.completed).map(task => (
                  <button
                    key={task.id}
                    onClick={() => saveNoteToTask(task.id, taskPickerContent)}
                    disabled={linkedTaskIds.has(task.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                      linkedTaskIds.has(task.id)
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-white border-black/5 hover:bg-emerald-50 hover:border-emerald-200"
                    )}
                  >
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      {getSubjectIcon(task.subject)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{task.subject}</p>
                      {task.description && (
                        <p className="text-xs text-stone-400 truncate">{task.description}</p>
                      )}
                    </div>
                    {linkedTaskIds.has(task.id) ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <Check size={16} />
                        <span className="text-xs font-medium">Sparat</span>
                      </div>
                    ) : (
                      <span className="text-xs text-stone-400 capitalize">{task.day}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
