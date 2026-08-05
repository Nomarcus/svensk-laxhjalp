import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as ImageIcon, Loader2, Bot, X, Calculator, BookOpen, Languages, Beaker, Globe, Book, Check, Sparkles } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
  limit,
  startAfter,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { generateHomeworkHelp, generateImage, analyzeHomeworkForTask } from '../services/geminiService';
import { compressImage } from '../utils/image';
import { isLikelyImageFile } from '../utils/imageUpload';
import { cn } from '../utils/cn';
import { isRequirementsList } from '../utils/detectRequirementsList';
import type { Message, ChatSession, Task } from '../types';

/**
 * Mirrors the server's token budget (server/lib/chatRequestValidation.ts,
 * MAX_HISTORY_TOKEN_BUDGET) so the client doesn't upload the entire, ever-growing
 * conversation on every message when the server trims most of it away anyway.
 * The server remains authoritative — this is a bandwidth/CPU optimization, not a
 * correctness boundary.
 */
const CLIENT_HISTORY_TOKEN_BUDGET = 4000;

function trimHistoryForRequest(
  items: { role: 'user' | 'model'; content: string }[],
): { role: 'user' | 'model'; content: string }[] {
  const kept: { role: 'user' | 'model'; content: string }[] = [];
  let usedTokens = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const msg = items[i];
    const approxTokens = Math.max(1, Math.ceil(msg.content.length / 4));
    if (usedTokens + approxTokens > CLIENT_HISTORY_TOKEN_BUDGET) break;
    usedTokens += approxTokens;
    kept.push(msg);
  }
  return kept.reverse();
}
import ChatHeader from './chat/ChatHeader';
import ChatMessage from './chat/ChatMessage';
import ChatInput, { type HomeworkImageActionId } from './chat/ChatInput';
import ChatEmptyState from './chat/ChatEmptyState';
import { useSpeech } from '../hooks/useSpeech';
import FreeTierUsageBar from './FreeTierUsageBar';
import { bumpUsageRefresh } from '../utils/usageRefresh';

const CHAT_MAX_IMAGES = 5;

const FIRESTORE_IMAGE_SOFT_LIMIT_BYTES = 1024 * 1024;

// Firestore rules count `string.size()` in UTF-8 bytes. Keep each saved AI
// message comfortably under both the original rule limit (10000) and the
// current one (50000) so long study materials never trip permission errors,
// regardless of which rules version is deployed.
const MAX_MESSAGE_BYTES = 9000;
const CONTINUATION_MARKER = '\n\n*[fortsätter…]*';

const utf8ByteLength = (s: string) => new TextEncoder().encode(s).length;

const splitForFirestoreMessages = (text: string): string[] => {
  if (utf8ByteLength(text) <= MAX_MESSAGE_BYTES) return [text];

  const chunks: string[] = [];
  let remaining = text;
  const markerBytes = utf8ByteLength(CONTINUATION_MARKER);

  while (remaining.length > 0) {
    if (utf8ByteLength(remaining) <= MAX_MESSAGE_BYTES) {
      chunks.push(remaining);
      break;
    }
    const budget = MAX_MESSAGE_BYTES - markerBytes;
    let lo = 1;
    let hi = remaining.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (utf8ByteLength(remaining.slice(0, mid)) <= budget) lo = mid;
      else hi = mid - 1;
    }
    let cut = lo;
    const paraBreak = remaining.lastIndexOf('\n\n', lo);
    if (paraBreak > Math.max(0, lo - 800)) {
      cut = paraBreak + 2;
    } else {
      const lineBreak = remaining.lastIndexOf('\n', lo);
      if (lineBreak > Math.max(0, lo - 200)) cut = lineBreak + 1;
    }
    if (cut <= 0) cut = lo;
    chunks.push(remaining.slice(0, cut).replace(/\s+$/, '') + CONTINUATION_MARKER);
    remaining = remaining.slice(cut);
  }
  return chunks;
};

interface ChatProps {
  childId: string;
  childName: string;
  childGrade?: string;
  ownerId: string;
  tasks?: Task[];
  taskContext?: { taskId: string; subject: string; description: string; imageUrl?: string; imageUrls?: string[] } | null;
  onTaskContextUsed?: () => void;
  onCreateTask?: (subject: string, description: string) => void;
  onCreateTaskFromPhoto?: (data: { subject: string; description: string; workDays: string[]; dueDay: string; minutesPerDay: number; imageUrl?: string }) => void;
}

export default function Chat({ childId, childName, childGrade, ownerId, tasks = [], taskContext, onTaskContextUsed, onCreateTask, onCreateTaskFromPhoto }: ChatProps) {
  const { t, i18n } = useTranslation();
  const speech = useSpeech();
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const oldestMsgCursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [selectedImageActionId, setSelectedImageActionId] = useState<HomeworkImageActionId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const generatingImageLockRef = useRef(false);
  const [streamingModelText, setStreamingModelText] = useState('');
  const [lastStreamingText, setLastStreamingText] = useState('');
  const [librarySaveError, setLibrarySaveError] = useState<string | null>(null);
  /** Senast lyckade bildanalys: samma bilder skickas igen vid "nästa uppgift". */
  const [stickyImageContext, setStickyImageContext] = useState<{ payload: string[]; dataUrls: string[] } | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [taskPickerContent, setTaskPickerContent] = useState<string | null>(null);
  const [linkedTaskIds, setLinkedTaskIds] = useState<Set<string>>(new Set());
  const [creatingAutoTask, setCreatingAutoTask] = useState(false);
  const [simpleSwedish, setSimpleSwedish] = useState(() => localStorage.getItem('simple-swedish') === 'true');
  const [coachMode, setCoachMode] = useState(() => localStorage.getItem('coach-mode') === 'true');
  const [showOnboardingTips, setShowOnboardingTips] = useState(() => localStorage.getItem('homework-chat-onboarding-seen') !== 'true');
  const scrollRef = useRef<HTMLDivElement>(null);

  const dataUrlSizeBytes = (dataUrl: string): number => {
    const i = dataUrl.indexOf(',');
    const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
    const len = b64.length;
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor((len * 3) / 4) - padding;
  };

  /** Höj OCR-kvalitet men håll oss under Firestore-gränsen via iterativ nedskalning. */
  const compressForChatUpload = async (dataUrl: string): Promise<string> => {
    let maxW = 1280;
    let maxH = 1280;
    let quality = 0.75;
    let out = await compressImage(dataUrl, maxW, maxH, quality);

    while (dataUrlSizeBytes(out) > FIRESTORE_IMAGE_SOFT_LIMIT_BYTES && quality > 0.45) {
      quality = Math.max(0.45, quality - 0.06);
      out = await compressImage(dataUrl, maxW, maxH, quality);
    }
    while (dataUrlSizeBytes(out) > FIRESTORE_IMAGE_SOFT_LIMIT_BYTES && maxW > 720) {
      maxW = Math.max(720, Math.round(maxW * 0.88));
      maxH = Math.max(720, Math.round(maxH * 0.88));
      out = await compressImage(dataUrl, maxW, maxH, quality);
    }
    return out;
  };

  const toggleSimpleSwedish = () => {
    setSimpleSwedish(prev => {
      const next = !prev;
      localStorage.setItem('simple-swedish', String(next));
      return next;
    });
  };

  const toggleCoachMode = () => {
    setCoachMode(prev => {
      const next = !prev;
      localStorage.setItem('coach-mode', String(next));
      return next;
    });
  };

  // Reset speaking state when all chunks are done
  const isActive = speech.isSpeaking || speech.isPaused;
  useEffect(() => {
    if (!isActive && speakingMessageId) {
      setSpeakingMessageId(null);
    }
  }, [isActive, speakingMessageId]);

  const createNewSession = useCallback(async () => {
    if (!auth.currentUser || !childId) return;
    try {
      const ref = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
      const docRef = await addDoc(ref, {
        title: `Chatt ${new Date().toLocaleDateString()}`,
        createdAt: serverTimestamp(),
      });
      setStickyImageContext(null);
      setActiveSessionId(docRef.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'chatSessions');
    }
  }, [childId, ownerId]);

  useEffect(() => {
    setStickyImageContext(null);
    setSelectedImageActionId(null);
  }, [activeSessionId]);

  useEffect(() => {
    if (images.length === 0) setSelectedImageActionId(null);
  }, [images.length]);

  useEffect(() => {
    if (!auth.currentUser || !childId) return;
    const sessionsRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ChatSession[];
        setSessions(data);
        if (data.length > 0) {
          setActiveSessionId((prev) => {
            if (!prev || !data.find((s) => s.id === prev)) return data[0].id;
            return prev;
          });
        } else {
          void createNewSession();
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'chatSessions'),
    );

    return () => unsubscribe();
  }, [childId, ownerId, createNewSession]);

  useEffect(() => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    setOlderMessages([]);
    setHasMoreOlder(false);
    oldestMsgCursorRef.current = null;

    const coll = collection(
      db,
      'users',
      ownerId,
      'children',
      childId,
      'chatSessions',
      activeSessionId,
      'messages',
    );
    const q = query(coll, orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chronological = [...snapshot.docs].reverse().map((d) => ({ id: d.id, ...d.data() })) as Message[];
        setMessages(chronological);
        oldestMsgCursorRef.current = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1]! : null;
        setHasMoreOlder(snapshot.docs.length === 50);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'messages'),
    );

    return () => unsubscribe();
  }, [childId, activeSessionId, ownerId]);

  const loadOlderMessages = async () => {
    if (!auth.currentUser || !childId || !activeSessionId || !oldestMsgCursorRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const coll = collection(
        db,
        'users',
        ownerId,
        'children',
        childId,
        'chatSessions',
        activeSessionId,
        'messages',
      );
      const q = query(coll, orderBy('timestamp', 'desc'), startAfter(oldestMsgCursorRef.current), limit(50));
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMoreOlder(false);
        return;
      }
      const batch = [...snap.docs].reverse().map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setOlderMessages((prev) => [...batch, ...prev]);
      oldestMsgCursorRef.current = snap.docs[snap.docs.length - 1]!;
      setHasMoreOlder(snap.docs.length === 50);
    } catch (err) {
      console.error('loadOlderMessages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  const displayMessages = [...olderMessages, ...messages];

  const dismissOnboardingTips = () => {
    localStorage.setItem('homework-chat-onboarding-seen', 'true');
    setShowOnboardingTips(false);
  };

  const readSummary = (content: string) => {
    const summary = content
      .replace(/[#*_`>-]/g, ' ')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join('. ');
    if (summary) void speech.speak(summary, i18n.language);
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clear lastStreamingText once new messages appear in Firestore
  useEffect(() => {
    if (lastStreamingText && displayMessages.length > 0) {
      const lastMsg = displayMessages[displayMessages.length - 1];
      if (lastMsg?.role === 'model' && lastMsg.content.includes(lastStreamingText.slice(0, 100))) {
        setLastStreamingText('');
      }
    }
  }, [displayMessages, lastStreamingText]);

  const taskContextProcessed = useRef(false);

  const clearChat = async () => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    if (!window.confirm(t('chat.clearChatConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId));
      setStickyImageContext(null);
      setActiveSessionId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chatSessions/${activeSessionId}`);
    }
  };

  const saveToLibrary = async (message: Message) => {
    if (!auth.currentUser || !childId) return;
    setLibrarySaveError(null);
    try {
      const libraryRef = collection(db, 'users', ownerId, 'children', childId, 'library');
      await addDoc(libraryRef, {
        title: message.content.split('\n')[0].replace(/[#*]/g, '').slice(0, 50) || t('chat.saved'),
        content: message.content,
        type: message.generatedImage ? 'image' : 'text',
        imageUrl: message.generatedImage || null,
        createdAt: serverTimestamp(),
        subject: 'Allmänt',
      });
      setSavedMessageIds(prev => new Set(prev).add(message.id));
    } catch (err) {
      setLibrarySaveError(t('chat.unexpectedError'));
      console.error('Failed to save library item', err);
    }
  };

  const deleteOwnMessage = async (messageId: string) => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    try {
      await deleteDoc(
        doc(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages', messageId),
      );
    } catch (err) {
      setError(t('chat.unexpectedError'));
      console.error('Failed to delete own message', err);
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

  const handleCreateStudyMaterial = (requirementsText: string) => {
    const prompt = `Du har fått en lista med krav och kriterier från en lärare. Skapa ett KOMPLETT LÄXUNDERLAG som barnet kan använda för att plugga inför provet — perfekt om man glömt boken hemma.

LÄXUNDERLAGET SKA INNEHÅLLA (med tydliga rubriker och stycken):

## 📖 Översikt
Kort introduktion till området och varför det är viktigt.

## 🎯 Grundläggande begrepp (för betyget E)
Förklara varje krav på betyget E utförligt med:
- Definition
- Konkreta vardagsexempel
- Förtydligande illustration i ord

## 🔬 Fördjupning (för betygen A-C)
Förklara de djupare kraven utförligt med:
- Förklaring av "varför" och "hur"
- Kemiska formler där det är relevant
- Exempel på beräkningar

## 📝 Övningsfrågor
5-10 övningsfrågor som täcker alla krav, gradvis svårare.

## ✅ Facit
Korrekta svar med korta motiveringar.

## 💡 Sammanfattning & minnestips
Kortfattad sammanfattning av det viktigaste + tips för att komma ihåg.

REGLER:
- Använd tydliga rubriker (## och ###)
- Använd korta stycken, inte långa textmassor
- Använd punktlistor där det passar
- Anpassa språket till barnets årskurs
- Inkludera ALLA krav från läraren
- Gör det pedagogiskt och motiverande

Krav från läraren:
${requirementsText}`;

    sendMessage(prompt, 'Skapar komplett läxunderlag...', { forceCoachMode: false });
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
      const plain = message.content
        .replace(/[`*_>#-]/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 320);
      const shareText = `${t('chat.shareIntro')}\n\n${plain}`;
      if (navigator.share) {
        await navigator.share({ title: t('chat.printTitle'), text: shareText, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert(t('chat.textCopied'));
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleGenerateImage = async (messageId: string, content: string) => {
    if (!auth.currentUser || !childId || !activeSessionId) return;
    if (generatingImageLockRef.current) return;
    generatingImageLockRef.current = true;
    setGeneratingImageId(messageId);
    const path = `users/${ownerId}/children/${childId}/chatSessions/${activeSessionId}/messages/${messageId}`;
    try {
      const imageUrl = await generateImage(content, childGrade);
      if (imageUrl) {
        const compressed = await compressForChatUpload(imageUrl);
        await updateDoc(doc(db, path), { generatedImage: compressed });
        const libraryRef = collection(db, 'users', ownerId, 'children', childId, 'library');
        await addDoc(libraryRef, {
          title: content.split('\n')[0].replace(/[#*]/g, '').slice(0, 50) || t('chat.saved'),
          content,
          type: 'image',
          imageUrl: compressed,
          createdAt: serverTimestamp(),
          subject: 'Chatt',
        });
      }
    } catch (err: unknown) {
      console.error('Error generating image:', err);
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('Uppgradera')
        || msg.includes('abonnemang')
        || msg.includes('Pro-abonnemang')
        || msg.includes('gratis')
        || msg.includes('403')
      ) {
        setError(`${msg} 👉 ${t('chat.goToSubscription')}`);
      } else {
        setError(t('chat.illustrateFailed'));
      }
    } finally {
      setGeneratingImageId(null);
      generatingImageLockRef.current = false;
    }
  };

  const handleAutoCreateTask = async (messageId: string, aiContent: string) => {
    if (!onCreateTaskFromPhoto) return;
    setCreatingAutoTask(true);
    try {
      // Find the user message before this AI response to get the image
      const aiMsgIndex = displayMessages.findIndex((m) => m.id === messageId);
      const prevMsg = aiMsgIndex > 0 ? displayMessages[aiMsgIndex - 1] : null;
      const urls = prevMsg?.attachments?.length ? prevMsg.attachments : undefined;
      const imageUrl = urls?.[0];

      const taskData = await analyzeHomeworkForTask(aiContent);
      bumpUsageRefresh();
      onCreateTaskFromPhoto({
        subject: taskData.subject,
        description: taskData.description,
        workDays: taskData.suggestedWorkDays,
        dueDay: taskData.suggestedDueDay,
        minutesPerDay: taskData.minutesPerDay,
        imageUrl,
      });
    } catch (err) {
      console.error('Error creating auto task:', err);
    } finally {
      setCreatingAutoTask(false);
    }
  };

  type ImageOverride = { payload: string[]; dataUrls: string[] };

  const sendMessage = async (
    e: React.FormEvent | string,
    displayText?: string,
    opts?: { imageOverride?: ImageOverride; forceCoachMode?: boolean },
  ) => {
    if (typeof e !== 'string') e.preventDefault();
    const typedText = typeof e === 'string' ? e : input.trim();
    const imageActionId = typeof e === 'string' ? null : selectedImageActionId;
    const imageActionPrompt = imageActionId ? t(`chat.imageActionPrompts.${imageActionId}`) : '';
    const imageActionDisplayText = imageActionId ? t(`chat.imageActions.${imageActionId}`) : '';
    const messageText = imageActionId
      ? `${imageActionPrompt}${typedText.trim() ? `\n\n${t('chat.imageActionExtraInstruction')}: ${typedText.trim()}` : ''}`
      : typedText;
    const override = opts?.imageOverride;
    const usingOverride = Boolean(override?.payload?.length);
    const effectiveCoachMode = opts?.forceCoachMode ?? coachMode;
    const trayImages = [...images];
    const currentDataUrls = usingOverride ? override!.dataUrls : trayImages;
    const imagePayload = usingOverride
      ? [...override!.payload]
      : trayImages.map((img) => (img.includes(',') ? img.split(',')[1] : img));

    if ((!messageText.trim() && !imagePayload.length) || loading || !auth.currentUser || !childId || !activeSessionId) return;

    if (typeof e !== 'string') {
      setInput('');
      setSelectedImageActionId(null);
    }
    if (!usingOverride) setImages([]);

    setLoading(true);
    setError(null);
    setStreamingModelText('');

    const visibleText = displayText || (
      imageActionId
        ? `${imageActionDisplayText}${typedText.trim() ? ` — ${typedText.trim()}` : ''}`
        : messageText || t('chat.analyzeImage')
    );

    try {
      const messagesRef = collection(db, 'users', ownerId, 'children', childId, 'chatSessions', activeSessionId, 'messages');

      try {
        await addDoc(messagesRef, {
          role: 'user',
          content: visibleText,
          timestamp: serverTimestamp(),
          attachments: currentDataUrls,
        });
      } catch (err: any) {
        if (err.message?.includes('exceeds the maximum allowed size')) {
          await addDoc(messagesRef, {
            role: 'user',
            content: visibleText + ' ' + t('chat.imageTooLarge'),
            timestamp: serverTimestamp(),
            attachments: [],
          });
        } else {
          handleFirestoreError(err, OperationType.CREATE, 'messages');
        }
      }

      const history = trimHistoryForRequest(
        displayMessages.map((m) => ({ role: m.role, content: m.content })),
      );
      const response = await generateHomeworkHelp(
        messageText || t('chat.analyzeImage'),
        history,
        undefined,
        simpleSwedish,
        i18n.language,
        imagePayload.length ? imagePayload : undefined,
        childGrade,
        (_delta, fullText) => setStreamingModelText(fullText),
        effectiveCoachMode,
      );

      // Split long AI responses across multiple messages so each chunk stays
      // safely under the Firestore rule's content-size cap (UTF-8 bytes).
      const chunks = splitForFirestoreMessages(response);
      try {
        for (const chunk of chunks) {
          await addDoc(messagesRef, { role: 'model', content: chunk, timestamp: serverTimestamp() });
        }
      } catch (err: any) {
        console.error('Error saving AI response:', err);
        throw err;
      }
      if (imagePayload.length) {
        setStickyImageContext({ payload: [...imagePayload], dataUrls: [...currentDataUrls] });
      }
      bumpUsageRefresh();
    } catch (err: any) {
      const msg = err.message || '';
      if (
        msg.includes('Uppgradera')
        || msg.includes('abonnemang')
        || msg.includes('Pro-abonnemang')
        || msg.includes('gratis')
      ) {
        setError(`${msg} 👉 ${t('chat.goToSubscription')}`);
      } else if (msg.includes('RESOURCE_EXHAUSTED')) {
        setError(t('chat.aiOverloaded'));
      } else {
        setError(msg || t('chat.unexpectedError'));
      }
    } finally {
      if (streamingModelText) {
        setLastStreamingText(streamingModelText);
      }
      setStreamingModelText('');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskContext && activeSessionId && !loading && !taskContextProcessed.current) {
      taskContextProcessed.current = true;
      const prompt = `Jag behöver hjälp med denna läxa:\n\n<uppgift-kontext>\nÄmne: ${taskContext.subject}\n${taskContext.description ? `Beskrivning: ${taskContext.description}\n` : ''}</uppgift-kontext>\n\nFörklara vad uppgiften handlar om och ge tips på hur jag som förälder kan hjälpa mitt barn.`;

      const fromTask = taskContext.imageUrls?.length
        ? taskContext.imageUrls.slice(0, CHAT_MAX_IMAGES)
        : taskContext.imageUrl
          ? [taskContext.imageUrl]
          : [];
      if (fromTask.length) setImages(fromTask);

      setTimeout(() => {
        void sendMessage(prompt);
        onTaskContextUsed?.();
      }, 500);
    }
    if (!taskContext) {
      taskContextProcessed.current = false;
    }
  }, [taskContext, activeSessionId, loading, onTaskContextUsed]);

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-950 md:bg-transparent relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (!files?.length) return;
        void (async () => {
          const toAdd: string[] = [];
          for (let i = 0; i < files.length && toAdd.length < CHAT_MAX_IMAGES; i++) {
            const file = files[i];
            if (!isLikelyImageFile(file)) continue;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            try {
              toAdd.push(await compressForChatUpload(dataUrl));
            } catch {
              toAdd.push(dataUrl);
            }
          }
          if (toAdd.length) setImages((prev) => [...prev, ...toAdd].slice(0, CHAT_MAX_IMAGES));
        })();
      }}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-600/10 backdrop-blur-[2px] z-50 flex items-center justify-center border-4 border-dashed border-emerald-600 m-4 rounded-3xl pointer-events-none">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <ImageIcon size={32} />
            </div>
            <h3 className="text-xl font-serif italic text-emerald-900">{t('chat.dropImageHere')}</h3>
            <p className="text-emerald-600/60 text-sm">{t('chat.toAnalyzeHomework')}</p>
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
        simpleSwedish={simpleSwedish}
        onToggleSimpleSwedish={toggleSimpleSwedish}
        coachMode={coachMode}
        onToggleCoachMode={toggleCoachMode}
      />

      <div className="px-4 md:px-8 pt-2 max-w-3xl mx-auto w-full shrink-0">
        <FreeTierUsageBar className="w-full" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {error && (
          <div className="max-w-3xl mx-auto mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {speech.ttsNotice && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl text-amber-900 dark:text-amber-100 text-sm flex items-center justify-between gap-3">
            <span>{speech.ttsNotice}</span>
            <button
              type="button"
              onClick={() => speech.clearTtsNotice()}
              className="p-1 shrink-0 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg"
              aria-label={t('chat.dismissVoiceNotice')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {librarySaveError && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl text-amber-900 dark:text-amber-100 text-sm flex items-center justify-between gap-3">
            <span>{librarySaveError}</span>
            <button type="button" onClick={() => setLibrarySaveError(null)} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg">
              <X size={16} />
            </button>
          </div>
        )}

        {showOnboardingTips && displayMessages.length === 0 && !loading && (
          <div className="max-w-3xl mx-auto mb-4 rounded-3xl border border-emerald-100 bg-emerald-50/90 p-4 text-sm text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold"><Sparkles size={16} />Kom igång på en minut</div>
              <button type="button" onClick={dismissOnboardingTips} className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-900/40" aria-label="Stäng tips"><X size={14} /></button>
            </div>
            <ol className="grid gap-2 sm:grid-cols-4">
              <li className="rounded-2xl bg-white/80 p-2 dark:bg-slate-900/50">1. Lägg till barn.</li>
              <li className="rounded-2xl bg-white/80 p-2 dark:bg-slate-900/50">2. Välj årskurs.</li>
              <li className="rounded-2xl bg-white/80 p-2 dark:bg-slate-900/50">3. Fota en läxa.</li>
              <li className="rounded-2xl bg-white/80 p-2 dark:bg-slate-900/50">4. Spara till planeringen.</li>
            </ol>
            <p className="mt-3 text-xs text-emerald-800/80 dark:text-emerald-100/80">Du behöver inte kunna ämnet själv. Vi tar en uppgift i taget. Börja med en bild om du är osäker.</p>
          </div>
        )}

        {hasMoreOlder && (
          <div className="max-w-3xl mx-auto flex justify-center pb-2">
            <button
              type="button"
              onClick={() => void loadOlderMessages()}
              disabled={loadingOlder}
              className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
            >
              {loadingOlder ? t('chat.loadingOlder') : t('chat.loadOlder')}
            </button>
          </div>
        )}

        {displayMessages.length === 0 && !loading ? (
          <ChatEmptyState childName={childName} onSendStarter={sendMessage} />
        ) : (
          displayMessages.map((msg, idx) => {
            const lastMessageIndex = displayMessages.length - 1;
            // Check if the user message before this AI response had an image
            const prevMsg = idx > 0 ? displayMessages[idx - 1] : null;
            const hasImage = msg.role === 'model' && prevMsg?.role === 'user' && (prevMsg.attachments?.length ?? 0) > 0;
            const isLatestModel = msg.role === 'model' && idx === lastMessageIndex;
            const canContinueNextExercise =
              Boolean(isLatestModel && stickyImageContext?.payload.length && !loading);
            const showStudyMaterialButton =
              msg.role === 'model' &&
              (isRequirementsList(msg.content) || (prevMsg?.role === 'user' && isRequirementsList(prevMsg.content)));
            const studyMaterialSource =
              prevMsg?.role === 'user' && isRequirementsList(prevMsg.content) ? prevMsg.content : msg.content;

            return (
              <ChatMessage
                key={msg.id}
                msg={msg}
                generatingImageId={generatingImageId}
                savedMessageIds={savedMessageIds}
                onShare={handleShare}
                onSaveToLibrary={saveToLibrary}
                onDeleteOwnMessage={deleteOwnMessage}
                onGenerateImage={handleGenerateImage}
                isRequirementsList={showStudyMaterialButton}
                onCreateStudyMaterial={() => handleCreateStudyMaterial(studyMaterialSource)}
                onAskCurriculum={(content) => {
                  sendMessage(`Förklara hur det du just berättade om kopplas till den svenska läroplanen (Lgr22). Vilka centrala innehåll och kunskapskrav berörs? Ge konkreta kopplingar så jag som förälder förstår varför mitt barn lär sig detta.\n\nDin förklaring var:\n${content.slice(0, 500)}`, t('chat.curriculumLink'));
                }}
                onAskFacitShort={(content) => {
                  sendMessage(`Ge ett KORT facit för uppgiften du just förklarade.\n\nVIKTIGT FORMAT:\n- Använd en numrerad lista: 1), 2), 3)\n- En rad per deluppgift\n- Skriv endast slutsvar per del\n- Avsluta med rubriken "Vanliga fel" och 2 korta punkter\n- Skriv inte långa stycken\n\nDin förklaring var:\n${content.slice(0, 500)}`, t('chat.showAnswerKeyShort'), { forceCoachMode: false });
                }}
                onAskFacitSteps={(content) => {
                  sendMessage(`Ge ett FULLSTÄNDIGT facit steg för steg för uppgiften du just förklarade.\n\nDU MÅSTE SVARA I EXAKT DENNA STRUKTUR:\n## Deluppgift 1\n### Steg 1: Ställ upp\n- Visa uppställningen i ett markdown-kodblock (tre backticks) med monospace, rad för rad så kolumnerna blir tydliga.\n### Steg 2: Räkna\n- Visa mellanled i korta, separata rader.\n### Steg 3: Svar\n- **Svar: ...**\n\n(Upprepa samma struktur för varje deluppgift)\n\nAVSLUTNING:\n## Vanliga fel\n- Punkt 1\n- Punkt 2\n- Punkt 3 (vid behov)\n\nREGLER:\n- Inga långa stycken\n- Inga "-----" eller kompakta engångsrader\n- En rad per steg, tydligt spaltat\n- Vid matte-uppställning: använd alltid markdown-kodblock (tre backticks)\n\nDin förklaring var:\n${content.slice(0, 500)}`, t('chat.showAnswerKeySteps'), { forceCoachMode: false });
                }}
                onAskFacitParent={(content) => {
                  sendMessage(`Ge ett facit anpassat för föräldern.\n\nFORMAT:\n## Deluppgift 1\n1) Svar: ...\n2) Kort förklaring: ...\n3) Vanligt misstag: ...\n\n(Upprepa för varje deluppgift)\n\nOm det är matte, lägg uppställningen i ett markdown-kodblock (tre backticks) så kolumnerna blir tydliga.\n\nAvsluta med:\n## Vanliga fel\n- 2-3 korta punkter\n\nREGLER:\n- Kort och tydligt\n- Spaltat rad för rad\n- Inga långa stycken\n\nDin förklaring var:\n${content.slice(0, 500)}`, t('chat.showAnswerKeyParent'), { forceCoachMode: false });
                }}
                onAskFordjupning={(content) => {
                  sendMessage(`Baserat på din förklaring, ge förslag på relaterade ämnen och kopplingar som kan fördjupa mitt barns förståelse. Ge 2-3 konkreta förslag på vad vi kan utforska vidare, med en kort förklaring av hur det kopplar till det vi just pratat om. Skriv det så att jag som förälder kan ta upp det med mitt barn.\n\nDin förklaring var:\n${content.slice(0, 500)}`, t('chat.deepDive'));
                }}
                onStartFirstExercise={
                  canContinueNextExercise && stickyImageContext
                    ? () =>
                        void sendMessage(
                          coachMode ? t('chat.firstExercisePromptCoach') : t('chat.firstExercisePrompt'),
                          t('chat.firstExerciseDisplay'),
                          { imageOverride: stickyImageContext },
                        )
                    : undefined
                }
                onContinueNextExercise={
                  canContinueNextExercise && stickyImageContext
                    ? () =>
                        void sendMessage(
                          coachMode ? t('chat.nextExercisePromptCoach') : t('chat.nextExercisePrompt'),
                          t('chat.nextExerciseDisplay'),
                          { imageOverride: stickyImageContext },
                        )
                    : undefined
                }
                speechState={speakingMessageId === msg.id ? {
                  isSpeaking: speech.isSpeaking,
                  isPaused: speech.isPaused,
                  currentChunk: speech.currentChunk,
                  totalChunks: speech.totalChunks,
                  onSpeak: () => { speech.stop(); setSpeakingMessageId(msg.id); void speech.speak(msg.content, i18n.language); },
                  onPause: speech.pause,
                  onResume: speech.resume,
                  onNext: speech.next,
                  onStop: () => { speech.stop(); setSpeakingMessageId(null); },
                } : {
                  isSpeaking: false,
                  isPaused: false,
                  currentChunk: 0,
                  totalChunks: 0,
                  onSpeak: () => { speech.stop(); setSpeakingMessageId(msg.id); void speech.speak(msg.content, i18n.language); },
                  onPause: speech.pause,
                  onResume: speech.resume,
                  onNext: speech.next,
                  onStop: () => { speech.stop(); setSpeakingMessageId(null); },
                }}
                onReadSummary={readSummary}
                speechSupported={speech.isSupported}
                onAutoCreateTask={onCreateTaskFromPhoto ? handleAutoCreateTask : undefined}
                creatingAutoTask={creatingAutoTask}
                hasImage={hasImage}
                onAddToPlanner={tasks.length > 0 ? (content) => {
                  setTaskPickerContent(content);
                } : undefined}
                onCreateTask={onCreateTask ? (content) => {
                  // Extract a subject from the first line, default to 'Allmänt'
                  const firstLine = content.split('\n')[0].replace(/[#*]/g, '').trim();
                  const subject = firstLine.length > 3 && firstLine.length < 60 ? firstLine : 'Allmänt';
                  const description = content.length > 300 ? content.slice(0, 300) + '...' : content;
                  onCreateTask(subject, description);
                } : undefined}
              />
            );
          })
        )}

        {(loading || lastStreamingText) && (
          <div className="flex gap-4 mr-auto">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Bot size={16} />
            </div>
            {streamingModelText || lastStreamingText ? (
              <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-sm rounded-2xl rounded-tl-none px-4 py-3 max-w-3xl">
                <div className="markdown-body prose prose-stone prose-sm max-w-none">
                  {streamingModelText || lastStreamingText}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-sm rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span className="text-sm text-stone-500 italic">{t('chat.thinking')}</span>
              </div>
            )}
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        images={images}
        setImages={setImages}
        maxImages={CHAT_MAX_IMAGES}
        loading={loading}
        onSubmit={sendMessage}
        selectedImageActionId={selectedImageActionId}
        onImageActionSelect={setSelectedImageActionId}
        onClearImageAction={() => setSelectedImageActionId(null)}
        coachMode={coachMode}
      />

      {/* Task Picker Modal */}
      {taskPickerContent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setTaskPickerContent(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-black/5 animate-in zoom-in-95 duration-200 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-black/5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic">{t('chat.linkToTask')}</h3>
                <button onClick={() => setTaskPickerContent(null)} className="p-2 hover:bg-stone-100 rounded-full text-stone-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-stone-500 mt-1">{t('chat.chooseTask')}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tasks.filter(t => !t.completed).length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-8 italic">{t('chat.noActiveTasks')}</p>
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
                        <span className="text-xs font-medium">{t('chat.saved')}</span>
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
