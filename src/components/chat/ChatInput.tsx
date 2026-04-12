import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Image as ImageIcon, Camera, X, Mic, MicOff } from 'lucide-react';
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
}

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function ChatInput({ input, setInput, images, setImages, maxImages = 5, loading, onSubmit }: ChatInputProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef(input);
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

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-slate-950 md:bg-transparent md:dark:bg-transparent border-t md:border-t-0 dark:border-white/5">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto relative">
        {images.length > 0 && (
          <div className="absolute bottom-full left-0 mb-4 p-2 bg-white dark:bg-slate-800 rounded-xl border border-black/5 dark:border-white/5 shadow-lg flex flex-wrap gap-2 max-w-full">
            {images.map((img, idx) => (
              <div key={idx} className="relative group/thumb">
                <img src={img} alt="" className="w-12 h-12 object-cover rounded-lg border border-black/5" />
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 p-0.5 bg-stone-800 text-white rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity"
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder={t('chat.inputPlaceholder')}
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
        <p className="text-[10px] text-center text-stone-400 mt-1 uppercase tracking-widest">
          {t('chat.aiDisclaimer')}
        </p>
      </form>
    </div>
  );
}
