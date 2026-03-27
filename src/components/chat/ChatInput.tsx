import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Image as ImageIcon, Camera, X, Mic, MicOff } from 'lucide-react';
import { compressImage } from '../../utils/image';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  image: string | null;
  setImage: (val: string | null) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const SpeechRecognitionAPI = typeof window !== 'undefined'
  ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  : null;

export default function ChatInput({ input, setInput, image, setImage, loading, onSubmit }: ChatInputProps) {
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
      // setInput is a simple setter, not a React state setter, so we read current value via ref
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

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const compressed = await compressImage(reader.result as string);
        setImage(compressed);
      } catch (error) {
        console.error('Error compressing uploaded image:', error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  };

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-slate-950 md:bg-transparent md:dark:bg-transparent border-t md:border-t-0 dark:border-white/5">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto relative">
        {image && (
          <div className="absolute bottom-full left-0 mb-4 p-2 bg-white dark:bg-slate-800 rounded-xl border border-black/5 dark:border-white/5 shadow-lg flex items-center gap-2">
            <img src={image} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
            <button type="button" onClick={() => setImage(null)} className="p-1 hover:bg-stone-100 rounded-full text-stone-400">
              <X size={16} />
            </button>
          </div>
        )}
        <div className="relative flex items-end gap-2 bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl p-2 shadow-sm focus-within:border-emerald-500/50 transition-all">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
            title="Fota läxan"
          >
            <Camera size={20} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
            title="Välj bild"
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
              title={isListening ? 'Stoppa inspelning' : 'Tala in din fråga'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
            accept="image/*"
            className="hidden"
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            placeholder="Ställ en fråga eller fota läxan med kameraknappen..."
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
            disabled={(!input.trim() && !image) || loading}
            className="p-2 bg-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:bg-stone-300 transition-all shadow-sm hover:bg-emerald-700"
          >
            <Send size={20} />
          </button>
        </div>
        {isListening && (
          <p className="text-xs text-center text-red-500 mt-2 animate-pulse font-medium">
            🎙️ Lyssnar... Tala nu
          </p>
        )}
        <p className="text-[10px] text-center text-stone-400 mt-2 uppercase tracking-widest">
          AI-genererat innehåll kan vara felaktigt. Kontrollera alltid med läraren.
        </p>
      </form>
    </div>
  );
}
