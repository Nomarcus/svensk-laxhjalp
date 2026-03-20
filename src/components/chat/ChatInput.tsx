import React, { useRef } from 'react';
import { Send, Image as ImageIcon, X } from 'lucide-react';
import { compressImage } from '../../utils/image';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  image: string | null;
  setImage: (val: string | null) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ChatInput({ input, setInput, image, setImage, loading, onSubmit }: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="p-4 md:p-8 bg-white md:bg-transparent border-t md:border-t-0">
      <form onSubmit={onSubmit} className="max-w-3xl mx-auto relative">
        {image && (
          <div className="absolute bottom-full left-0 mb-4 p-2 bg-white rounded-xl border border-black/5 shadow-lg flex items-center gap-2">
            <img src={image} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
            <button type="button" onClick={() => setImage(null)} className="p-1 hover:bg-stone-100 rounded-full text-stone-400">
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
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
        <p className="text-[10px] text-center text-stone-400 mt-2 uppercase tracking-widest">
          AI-genererat innehåll kan vara felaktigt. Kontrollera alltid med läraren.
        </p>
      </form>
    </div>
  );
}
