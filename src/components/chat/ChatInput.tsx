import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Image as ImageIcon,
  Camera,
  X,
  Mic,
  MicOff,
  Lightbulb,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { compressImage } from '../../utils/image';
import { isLikelyImageFile } from '../../utils/imageUpload';
import { cn } from '../../utils/cn';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
  maxImages?: number;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  selectedImageActionId?: string | null;
  onImageActionSelect?: (actionId: HomeworkImageActionId) => void;
  onClearImageAction?: () => void;
  coachMode?: boolean;
  hasMessages?: boolean;
}

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

const homeworkImageActions = [
  { id: 'explainSimple', icon: Sparkles },
  { id: 'correct', icon: CheckCircle2 },
  { id: 'getStarted', icon: HelpCircle },
  { id: 'stepByStep', icon: ListChecks },
  { id: 'summarize', icon: Wand2 },
] as const;

export type HomeworkImageActionId = typeof homeworkImageActions[number]['id'];

export default function ChatInput({ input, setInput, images, setImages, maxImages = 5, loading, onSubmit, selectedImageActionId, onImageActionSelect, onClearImageAction, coachMode = false, hasMessages = false }: ChatInputProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef(input);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => { inputRef.current = input; }, [input]);

  useEffect(() => {
    if (!SpeechRecognitionAPI) return;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'sv-SE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const currentInput = inputRef.current;
      setInput(currentInput ? currentInput + ' ' + transcript : transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    return () => { try { recognition.stop(); } catch {} };
  }, [setInput]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const pushOneDataUrl = async (dataUrl: string) => {
    let finalUrl = dataUrl;
    try {
      finalUrl = await compressImage(dataUrl);
    } catch {
      /* raw */
    }
    setImages((prev) => (prev.length >= maxImages ? prev : [...prev, finalUrl].slice(0, maxImages)));
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  /** Kopiera File[] och nollställ input direkt — iOS kan annars tömma filreferensen före FileReader är klar. */
  const handlePickedFiles = async (files: File[]) => {
    for (const file of files) {
      if (!isLikelyImageFile(file)) continue;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await pushOneDataUrl(dataUrl);
      } catch {
        /* t.ex. trasig HEIC-läsning */
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    void (async () => {
      for (const item of Array.from(e.clipboardData.items)) {
        if (!item.type.startsWith('image')) continue;
        const file = item.getAsFile();
        if (!file) continue;
        const dataUrl = await readFileAsDataUrl(file);
        await pushOneDataUrl(dataUrl);
      }
    })();
  };

  const atMax = images.length >= maxImages;
  const showHomeworkImageActions = images.length > 0;

  const handleImageActionClick = (actionId: HomeworkImageActionId) => {
    if (onImageActionSelect) {
      onImageActionSelect(actionId);
    } else {
      setInput(t(`chat.imageActionPrompts.${actionId}`));
    }
    textareaRef.current?.focus();
  };

  const focusCustomPrompt = () => {
    onClearImageAction?.();
    textareaRef.current?.focus();
  };

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-slate-950 md:bg-transparent md:dark:bg-transparent border-t md:border-t-0 dark:border-white/5">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto relative">
        {coachMode && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-amber-900 dark:text-amber-100 text-xs">
            <Lightbulb size={14} className="shrink-0 mt-0.5 fill-amber-400 text-amber-600" />
            <span>{t('chat.coachModeActive')}</span>
          </div>
        )}
        {showHomeworkImageActions && (
          <div className="mb-3 space-y-2">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-black/5 dark:border-white/5 shadow-sm flex flex-wrap gap-2 max-w-full">
              {images.map((img, idx) => (
                <div key={idx} className="relative group/thumb">
                  <img src={img} alt="" className="w-12 h-12 object-cover rounded-lg border border-black/5" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 p-0.5 bg-stone-800 text-white rounded-full opacity-100 md:opacity-0 md:group-hover/thumb:opacity-100 transition-opacity"
                    aria-label={t('chat.removeAttachment')}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <span className="self-center text-[10px] text-stone-400 tabular-nums">
                {images.length}/{maxImages}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
              <div className="mb-3 grid grid-cols-3 gap-1.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                <span className="rounded-full bg-white/80 dark:bg-slate-900/70 px-2 py-1 text-center">1. {t('chat.imageStepPhoto')}</span>
                <span className="rounded-full bg-emerald-600 text-white px-2 py-1 text-center shadow-sm">2. {t('chat.imageStepChoose')}</span>
                <span className="rounded-full bg-white/80 dark:bg-slate-900/70 px-2 py-1 text-center">3. {t('chat.imageStepSend')}</span>
              </div>
              <p className="mb-1 text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                {t('chat.imageActionsTitle')}
              </p>
              <p className="mb-2 text-[10px] text-emerald-800/75 dark:text-emerald-100/75">
                {t('chat.imageActionRecommendation')}
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {homeworkImageActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={loading}
                      onClick={() => handleImageActionClick(action.id)}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                        selectedImageActionId === action.id
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                          : 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-slate-900 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
                        loading && 'cursor-not-allowed opacity-60'
                      )}
                      aria-pressed={selectedImageActionId === action.id}
                    >
                      <Icon size={14} />
                      {t(`chat.imageActions.${action.id}`)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={loading}
                  onClick={focusCustomPrompt}
                  className={cn(
                    'shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-slate-900 dark:text-stone-200 dark:hover:bg-white/5',
                    loading && 'cursor-not-allowed opacity-60'
                  )}
                >
                  {t('chat.imageActions.custom')}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-emerald-800/70 dark:text-emerald-100/70">
                {t('chat.imageActionsHint')}
              </p>
            </div>
          </div>
        )}
        <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-2 shadow-sm focus-within:border-emerald-500/50 transition-all">
          <button
            type="button"
            disabled={atMax || loading}
            onClick={() => cameraInputRef.current?.click()}
            className={cn(
              'p-2 rounded-xl transition-colors',
              atMax || loading ? 'text-stone-200 cursor-not-allowed' : 'text-stone-400 hover:text-amber-600 hover:bg-amber-50'
            )}
            title={t('chat.takePhoto')}
          >
            <Camera size={20} />
          </button>
          <button
            type="button"
            disabled={atMax || loading}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'p-2 rounded-xl transition-colors',
              atMax || loading ? 'text-stone-200 cursor-not-allowed' : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50'
            )}
            title={t('chat.chooseImage')}
          >
            <ImageIcon size={20} />
          </button>
          {SpeechRecognitionAPI && (
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-xl transition-colors ${
                isListening
                  ? 'text-red-600 bg-red-50 animate-pulse'
                  : 'text-stone-400 hover:text-red-600 hover:bg-red-50'
              }`}
              title={isListening ? t('chat.stopRecording') : t('chat.speakQuestion')}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => {
              const el = e.currentTarget;
              const picked = el.files?.length ? Array.from(el.files) : [];
              el.value = '';
              void handlePickedFiles(picked);
            }}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const el = e.currentTarget;
              const picked = el.files?.length ? Array.from(el.files) : [];
              el.value = '';
              void handlePickedFiles(picked);
            }}
            accept="image/*"
            multiple
            className="hidden"
          />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={coachMode ? t('chat.coachPlaceholder') : t('chat.inputPlaceholder')}
            className="flex-1 bg-transparent border-none focus:ring-0 py-2 px-2 resize-none max-h-32 min-h-[40px] text-[15px] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && images.length === 0) || loading}
            className="p-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:bg-stone-300 transition-all shadow-sm hover:bg-emerald-700"
          >
            <Send size={20} />
          </button>
        </div>
        {isListening && (
          <p className="text-xs text-center text-red-500 mt-2 animate-pulse font-medium">
            {t('chat.listening')}
          </p>
        )}
        {!atMax && (
          <p className="text-[10px] text-center text-stone-400 mt-2">
            {t('chat.multiImageHint', { max: maxImages })}
          </p>
        )}
        {!hasMessages && (
          <p className="text-[11px] text-center text-emerald-700/80 dark:text-emerald-300/80 mt-2 font-medium">
            {t('chat.parentReassurance', { defaultValue: 'Du behöver inte kunna allt själv — börja med en bild eller en enkel fråga.' })}
          </p>
        )}
        <p className="text-[10px] text-center text-stone-400 mt-1 uppercase tracking-widest">
          {t('chat.aiDisclaimer')}
        </p>
      </form>
    </div>
  );
}
