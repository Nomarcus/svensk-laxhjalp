import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Loader2, User, Bot, X, Plus, Trash2, MessageSquare, Share2, BookmarkPlus, Check } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, Timestamp, limit, getDocs, deleteDoc } from 'firebase/firestore';
import { generateHomeworkHelp, generateImage } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { updateDoc, doc } from 'firebase/firestore';
import { compressImage } from '../utils/image';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
  attachments?: string[];
  generatedImage?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
}

interface ChatProps {
  childId: string;
  childName: string;
  ownerId: string;
}

export default function Chat({ childId, childName, ownerId }: ChatProps) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch sessions
  useEffect(() => {
    if (!auth.currentUser || !childId) return;

    const sessionsRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatSession[];
      setSessions(sessionsData);

      if (sessionsData.length > 0) {
        if (!activeSessionId || !sessionsData.find(s => s.id === activeSessionId)) {
          setActiveSessionId(sessionsData[0].id);
        }
      } else {
        createNewSession();
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'chatSessions');
    });

    return () => unsubscribe();
  }, [childId, activeSessionId]);

  // Fetch messages for active session
  useEffect(() => {
    if (!auth.currentUser || !childId || !activeSessionId) return;

    const q = query(
      collection(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'messages');
    });

    return () => unsubscribe();
  }, [childId, activeSessionId]);

  const createNewSession = async () => {
    if (!auth.currentUser || !childId) return;
    try {
      const sessionsRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
      const docRef = await addDoc(sessionsRef, {
        title: `Chatt ${new Date().toLocaleDateString()}`,
        createdAt: serverTimestamp()
      });
      setActiveSessionId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chatSessions');
    }
  };

  const clearChat = async () => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    if (!window.confirm('Är du säker på att du vill rensa denna chatt?')) return;

    try {
      const sessionRef = doc(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId);
      await deleteDoc(sessionRef);
      setActiveSessionId(null); // This will trigger createNewSession via the effect if it was the last one
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chatSessions/${activeSessionId}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("Vänligen välj en bildfil.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result as string);
        setImage(compressed);
      } catch (error) {
        console.error("Error compressing uploaded image:", error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
        }
      }
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
        subject: 'Allmänt'
      });
      setSavedMessageIds(prev => new Set(prev).add(message.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'library');
    }
  };

  const handleShare = async (message: Message) => {
    const shareData = {
      title: 'Läxhjälp Förklaring',
      text: message.content,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
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
        // Compress the generated image to ensure it's under 1MB for Firestore
        const compressedImageUrl = await compressImage(imageUrl, 800, 800, 0.6);
        const messageRef = doc(db, path);
        await updateDoc(messageRef, { generatedImage: compressedImageUrl });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const sendMessage = async (e: React.FormEvent | string) => {
    if (typeof e !== 'string') e.preventDefault();
    const messageText = typeof e === 'string' ? e : input.trim();
    
    if ((!messageText && !image) || loading || !auth.currentUser || !childId || !activeSessionId) return;

    const userMessage = messageText;
    const currentImage = image;
    if (typeof e !== 'string') setInput('');
    setImage(null);
    setLoading(true);
    setError(null);

    try {
      const messagesRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages');
      
      // Save user message
      try {
        await addDoc(messagesRef, {
          role: 'user',
          content: userMessage || (currentImage ? "Analysera denna bild." : ""),
          timestamp: serverTimestamp(),
          attachments: currentImage ? [currentImage] : []
        });
      } catch (err: any) {
        if (err.message?.includes('exceeds the maximum allowed size')) {
          console.error("Bilden är för stor för att sparas i historiken.");
          // Still try to save without the image attachment if it's too big
          await addDoc(messagesRef, {
            role: 'user',
            content: (userMessage || "Analysera denna bild.") + " (Bilden var för stor för att sparas i historiken)",
            timestamp: serverTimestamp(),
            attachments: []
          });
        } else {
          handleFirestoreError(err, OperationType.CREATE, 'messages');
        }
      }

      // Generate AI response
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await generateHomeworkHelp(
        userMessage || "Analysera denna bild.",
        history,
        currentImage?.split(',')[1] // Send only base64 data
      );

      // Save AI response
      try {
        await addDoc(messagesRef, {
          role: 'model',
          content: response,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'messages');
      }

    } catch (error: any) {
      console.error("Error sending message:", error);
      if (error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 'RESOURCE_EXHAUSTED') {
        setError("AI-tjänsten är tillfälligt överbelastad. Vänta en stund och försök igen.");
      } else {
        setError("Ett oväntat fel uppstod. Försök igen senare.");
      }
    } finally {
      setLoading(false);
    }
  };

  const starters = [
    "Förklara fotosyntesen enkelt",
    "Hjälp med multiplikationstabellen",
    "Hur skriver man en bra berättelse?",
    "Vad är ett verb?",
    "Berätta om rymden"
  ];

  return (
    <div 
      className="flex-1 flex flex-col h-full bg-white md:bg-transparent relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-600/10 backdrop-blur-[2px] z-50 flex items-center justify-center border-4 border-dashed border-emerald-600 m-4 rounded-3xl pointer-events-none animate-in fade-in zoom-in-95">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <ImageIcon size={32} />
            </div>
            <h3 className="text-xl font-serif italic text-emerald-900">Släpp bilden här</h3>
            <p className="text-emerald-600/60 text-sm">för att analysera läxan</p>
          </div>
        </div>
      )}
      {/* Chat Header */}
      <div className="px-4 py-3 md:px-8 md:py-4 bg-white border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
            <MessageSquare size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-stone-900">Chatt med {childName}</h2>
              {sessions.length > 1 && (
                <select
                  value={activeSessionId || ''}
                  onChange={(e) => setActiveSessionId(e.target.value)}
                  className="text-[10px] bg-stone-50 border-none focus:ring-0 py-0 px-1 rounded text-stone-500 cursor-pointer"
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider">Aktiv session</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={createNewSession}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-all"
          >
            <Plus size={14} />
            <span>Ny chatt</span>
          </button>
          <button
            onClick={clearChat}
            className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title="Rensa chatt"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {error && (
          <div className="max-w-3xl mx-auto mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}
        {messages.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
              <Bot size={32} />
            </div>
            <h2 className="text-2xl font-serif italic mb-2">Hjälp {childName} med läxan</h2>
            <p className="text-stone-500 mb-8">
              Jag är här för att hjälpa dig som förälder att förklara {childName}s läxor på ett enkelt sätt. 
              Prova att klicka på ett förslag nedan:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(starter)}
                  className="px-4 py-2 bg-white border border-black/5 rounded-xl text-sm text-stone-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-4 max-w-3xl",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              msg.role === 'user' ? "bg-stone-200 text-stone-600" : "bg-emerald-600 text-white"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "space-y-2",
              msg.role === 'user' ? "items-end" : "items-start"
            )}>
              {msg.attachments?.map((att, i) => (
                <img key={i} src={att} alt="Attachment" className="max-w-xs rounded-xl border border-black/5 shadow-sm" />
              ))}
              {msg.generatedImage && (
                <img src={msg.generatedImage} alt="AI Generated Illustration" className="max-w-xs rounded-xl border border-black/5 shadow-sm" />
              )}
              <div className={cn(
                "px-4 py-3 rounded-2xl text-[15px] leading-relaxed relative group/msg",
                msg.role === 'user' 
                  ? "bg-emerald-600 text-white rounded-tr-none" 
                  : "bg-white border border-black/5 shadow-sm rounded-tl-none"
              )}>
                <div className="markdown-body prose prose-stone prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.role === 'model' && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleShare(msg)}
                      className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-stone-400 hover:text-emerald-600 transition-all border border-black/5"
                      title="Dela"
                    >
                      <Share2 size={14} />
                    </button>
                    <button 
                      onClick={() => saveToLibrary(msg)}
                      disabled={savedMessageIds.has(msg.id)}
                      className={cn(
                        "p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm transition-all border border-black/5",
                        savedMessageIds.has(msg.id) ? "text-emerald-600" : "text-stone-400 hover:text-emerald-600"
                      )}
                      title="Spara i bibliotek"
                    >
                      {savedMessageIds.has(msg.id) ? <Check size={14} /> : <BookmarkPlus size={14} />}
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'model' && !msg.generatedImage && (
                <button
                  onClick={() => handleGenerateImage(msg.id, msg.content)}
                  disabled={generatingImageId === msg.id}
                  className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-emerald-600 transition-colors mt-1 px-2 py-1 rounded-md hover:bg-emerald-50 disabled:opacity-50"
                >
                  {generatingImageId === msg.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ImageIcon size={12} />
                  )}
                  {generatingImageId === msg.id ? "Skapar illustration..." : "Illustrera förklaringen"}
                </button>
              )}
            </div>
          </div>
        ))}
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

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-white md:bg-transparent border-t md:border-t-0">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto relative">
          {image && (
            <div className="absolute bottom-full left-0 mb-4 p-2 bg-white rounded-xl border border-black/5 shadow-lg flex items-center gap-2">
              <img src={image} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
              <button 
                type="button"
                onClick={() => setImage(null)}
                className="p-1 hover:bg-stone-100 rounded-full text-stone-400"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2 bg-white border border-black/10 rounded-2xl p-2 shadow-sm focus-within:border-emerald-500/50 transition-all">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
            >
              <ImageIcon size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder="Skriv din fråga här eller klistra in en bild..."
              className="flex-1 bg-transparent border-none focus:ring-0 py-2 px-2 resize-none max-h-32 min-h-[40px] text-[15px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={(!input.trim() && !image) || loading}
              className="p-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:bg-stone-300 transition-all shadow-sm hover:bg-emerald-700"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-[10px] text-center text-stone-400 mt-2 uppercase tracking-widest">
            AI-genererat innehåll kan vara felaktigt. Kontrollera alltid med läraren.
          </p>
        </form>
      </div>
    </div>
  );
}
