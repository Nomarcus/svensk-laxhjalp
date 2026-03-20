import { User, Bot, Share2, BookmarkPlus, Check, ImageIcon, Loader2, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../utils/cn';
import type { Message } from '../../types';

interface ChatMessageProps {
  msg: Message;
  generatingImageId: string | null;
  savedMessageIds: Set<string>;
  onShare: (msg: Message) => void;
  onSaveToLibrary: (msg: Message) => void;
  onGenerateImage: (messageId: string, content: string) => void;
  onAskCurriculum?: (content: string) => void;
}

export default function ChatMessage({
  msg,
  generatingImageId,
  savedMessageIds,
  onShare,
  onSaveToLibrary,
  onGenerateImage,
  onAskCurriculum,
}: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-4 max-w-3xl',
        msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          msg.role === 'user' ? 'bg-stone-200 text-stone-600' : 'bg-emerald-600 text-white'
        )}
      >
        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={cn('space-y-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
        {msg.attachments?.map((att, i) => (
          <img key={i} src={att} alt="Attachment" className="max-w-xs rounded-xl border border-black/5 shadow-sm" />
        ))}
        {msg.generatedImage && (
          <img src={msg.generatedImage} alt="AI Generated Illustration" className="max-w-xs rounded-xl border border-black/5 shadow-sm" />
        )}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-[15px] leading-relaxed relative group/msg',
            msg.role === 'user'
              ? 'bg-emerald-600 text-white rounded-tr-none'
              : 'bg-white border border-black/5 shadow-sm rounded-tl-none'
          )}
        >
          <div className="markdown-body prose prose-stone prose-sm max-w-none">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
          {msg.role === 'model' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <button
                onClick={() => onShare(msg)}
                className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-stone-400 hover:text-emerald-600 transition-all border border-black/5"
                title="Dela"
              >
                <Share2 size={14} />
              </button>
              <button
                onClick={() => onSaveToLibrary(msg)}
                disabled={savedMessageIds.has(msg.id)}
                className={cn(
                  'p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm transition-all border border-black/5',
                  savedMessageIds.has(msg.id) ? 'text-emerald-600' : 'text-stone-400 hover:text-emerald-600'
                )}
                title="Spara i bibliotek"
              >
                {savedMessageIds.has(msg.id) ? <Check size={14} /> : <BookmarkPlus size={14} />}
              </button>
            </div>
          )}
        </div>
        {msg.role === 'model' && (
          <div className="flex flex-wrap gap-2 mt-1">
            {!msg.generatedImage && (
              <button
                onClick={() => onGenerateImage(msg.id, msg.content)}
                disabled={generatingImageId === msg.id}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-emerald-600 transition-colors px-2 py-1 rounded-md hover:bg-emerald-50 disabled:opacity-50"
              >
                {generatingImageId === msg.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ImageIcon size={12} />
                )}
                {generatingImageId === msg.id ? 'Skapar illustration...' : 'Illustrera förklaringen'}
              </button>
            )}
            {onAskCurriculum && (
              <button
                onClick={() => onAskCurriculum(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
              >
                <GraduationCap size={12} />
                Koppling till läroplanen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
