import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Bot, Share2, BookmarkPlus, Check, ImageIcon, Loader2, GraduationCap, Printer, CalendarPlus, ClipboardList, PlusCircle, Lightbulb, ScanLine, X, Volume2, Square, Pause, Play, SkipForward, Calculator } from 'lucide-react';
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
  onAskFacitShort?: (content: string) => void;
  onAskFacitSteps?: (content: string) => void;
  onAskFacitParent?: (content: string) => void;
  onAskFordjupning?: (content: string) => void;
  onAutoCreateTask?: (messageId: string, content: string) => void;
  onAddToPlanner?: (content: string) => void;
  onCreateTask?: (content: string) => void;
  hasImage?: boolean;
  creatingAutoTask?: boolean;
  speechState?: {
    isSpeaking: boolean;
    isPaused: boolean;
    currentChunk: number;
    totalChunks: number;
    onSpeak: () => void;
    onPause: () => void;
    onResume: () => void;
    onNext: () => void;
    onStop: () => void;
  };
  speechSupported?: boolean;
}

export default function ChatMessage({
  msg,
  generatingImageId,
  savedMessageIds,
  onShare,
  onSaveToLibrary,
  onGenerateImage,
  onAskCurriculum,
  onAskFacitShort,
  onAskFacitSteps,
  onAskFacitParent,
  onAskFordjupning,
  onAutoCreateTask,
  onAddToPlanner,
  onCreateTask,
  hasImage,
  creatingAutoTask,
  speechState,
  speechSupported,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const detectMathType = (content: string): string | null => {
    const text = content.toLowerCase();
    if (!/\d/.test(text)) return null;
    if (text.includes('bråk')) return t('chat.mathTypeFractions');
    if (text.includes('procent')) return t('chat.mathTypePercent');
    if (text.includes('ekvation')) return t('chat.mathTypeEquation');
    if (text.includes('uppställning') || text.includes('kolumn') || text.includes('ställ upp')) return t('chat.mathTypeColumn');
    if (text.includes('division')) return t('chat.mathTypeDivision');
    if (text.includes('multiplikation')) return t('chat.mathTypeMultiplication');
    return t('chat.mathTypeGeneral');
  };

  const isFacitMessage = (content: string) => {
    const text = content.toLowerCase();
    return text.includes('facit') || text.includes('korrekt svar') || text.includes('svar:');
  };

  const handlePrint = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printTitle = t('chat.printTitle');
    const printBody = content
      .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
      .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
      .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');

    printWindow.document.write(`<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>${printTitle}</title><style>
      body { font-family: Inter, Arial, sans-serif; max-width: 760px; margin: 36px auto; padding: 20px; color: #1a1a1a; line-height: 1.7; }
      h1 { font-size: 18px; color: #059669; border-bottom: 2px solid #059669; padding-bottom: 8px; }
      h2, h3 { color: #333; margin-top: 20px; }
      ul, ol { padding-left: 24px; }
      li { margin-bottom: 6px; }
      .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #999; text-align: center; }
      @media print { body { margin: 20px; } }
    </style></head><body>
      <h1>📚 ${printTitle}</h1>
      <div>${printBody}</div>
      <div class="footer">${printTitle} — ${new Date().toLocaleDateString('sv-SE')}</div>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };
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
          msg.role === 'user' ? 'bg-stone-200 dark:bg-slate-700 text-stone-600 dark:text-stone-300' : 'bg-emerald-600 text-white'
        )}
      >
        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={cn('space-y-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
        {msg.attachments?.map((att, i) => (
          <img
            key={i}
            src={att}
            alt="Attachment"
            className="max-w-xs rounded-xl border border-black/5 shadow-sm cursor-zoom-in active:scale-[0.98] transition-transform"
            onClick={() => setZoomedImage(att)}
          />
        ))}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-[15px] leading-relaxed relative group/msg',
            msg.role === 'user'
              ? 'bg-emerald-600 text-white rounded-tr-none'
              : 'bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 shadow-sm rounded-tl-none'
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
                title={t('chat.share')}
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
                title={t('chat.saveToLibrary')}
              >
                {savedMessageIds.has(msg.id) ? <Check size={14} /> : <BookmarkPlus size={14} />}
              </button>
            </div>
          )}
        </div>
        {msg.generatedImage && (
          <img
            src={msg.generatedImage}
            alt="AI Generated Illustration"
            className="max-w-xs rounded-xl border border-black/5 shadow-sm cursor-zoom-in active:scale-[0.98] transition-transform"
            onClick={() => setZoomedImage(msg.generatedImage!)}
          />
        )}
        {zoomedImage && (
          <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setZoomedImage(null)}
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 transition-colors z-10"
            >
              <X size={24} />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed illustration"
              className="max-w-full max-h-full object-contain rounded-xl"
              style={{ touchAction: 'pinch-zoom' }}
            />
          </div>
        )}
        {msg.role === 'model' && (
          <div className="flex flex-wrap gap-2 mt-1">
            {hasImage && detectMathType(msg.content) && (
              <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Calculator size={11} />
                {t('chat.detectedMathType')}: {detectMathType(msg.content)}
              </span>
            )}
            {speechSupported && speechState && (
              (speechState.isSpeaking || speechState.isPaused) ? (
                <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 rounded-md px-1">
                  <button
                    onClick={speechState.isSpeaking ? speechState.onPause : speechState.onResume}
                    className="flex items-center gap-1 text-[10px] text-emerald-600 px-1.5 py-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  >
                    {speechState.isSpeaking ? <Pause size={12} /> : <Play size={12} />}
                    {speechState.isSpeaking ? t('chat.pause') : t('chat.resume')}
                  </button>
                  {speechState.totalChunks > 1 && (
                    <button
                      onClick={speechState.onNext}
                      className="flex items-center gap-1 text-[10px] text-emerald-600 px-1.5 py-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      <SkipForward size={12} />
                      {t('chat.nextChunk')}
                    </button>
                  )}
                  <button
                    onClick={speechState.onStop}
                    className="flex items-center gap-1 text-[10px] text-red-500 px-1.5 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <Square size={10} />
                  </button>
                  {speechState.totalChunks > 1 && (
                    <span className="text-[9px] text-emerald-600/70 px-1">
                      {t('chat.chunkProgress', { current: speechState.currentChunk + 1, total: speechState.totalChunks })}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={speechState.onSpeak}
                  title={t('chat.listenHint')}
                  className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors px-2 py-1 rounded-md"
                >
                  <Volume2 size={12} />
                  {t('chat.listen')}
                </button>
              )
            )}
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
                {generatingImageId === msg.id ? t('chat.creatingIllustration') : t('chat.illustrate')}
              </button>
            )}
            {onAskCurriculum && (
              <button
                onClick={() => onAskCurriculum(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
              >
                <GraduationCap size={12} />
                {t('chat.curriculumLink')}
              </button>
            )}
            {onAskFacitShort && (
              <button
                onClick={() => onAskFacitShort(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-red-600 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeyShort')}
              </button>
            )}
            {onAskFacitSteps && (
              <button
                onClick={() => onAskFacitSteps(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-red-600 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeySteps')}
              </button>
            )}
            {onAskFacitParent && (
              <button
                onClick={() => onAskFacitParent(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-red-600 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeyParent')}
              </button>
            )}
            {isFacitMessage(msg.content) && onAddToPlanner && (
              <button
                onClick={() => onAddToPlanner(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-amber-600 transition-colors px-2 py-1 rounded-md hover:bg-amber-50"
              >
                <CalendarPlus size={12} />
                {t('chat.saveAnswerKeyToPlanner')}
              </button>
            )}
            {onAskFordjupning && (
              <button
                onClick={() => onAskFordjupning(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-yellow-600 transition-colors px-2 py-1 rounded-md hover:bg-yellow-50"
              >
                <Lightbulb size={12} />
                {t('chat.deepDive')}
              </button>
            )}
            {hasImage && onAutoCreateTask && (
              <button
                onClick={() => onAutoCreateTask(msg.id, msg.content)}
                disabled={creatingAutoTask}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-teal-600 transition-colors px-2 py-1 rounded-md hover:bg-teal-50 disabled:opacity-50"
              >
                {creatingAutoTask ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
                {creatingAutoTask ? t('chat.creatingTask') : t('chat.createTaskAi')}
              </button>
            )}
            <button
              onClick={() => handlePrint(msg.content)}
              className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-purple-600 transition-colors px-2 py-1 rounded-md hover:bg-purple-50"
            >
              <Printer size={12} />
              {t('chat.printAnswer')}
            </button>
            {onAddToPlanner && !isFacitMessage(msg.content) && (
              <button
                onClick={() => onAddToPlanner(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-amber-600 transition-colors px-2 py-1 rounded-md hover:bg-amber-50"
              >
                <CalendarPlus size={12} />
                {t('chat.addToPlanner')}
              </button>
            )}
            {onCreateTask && (
              <button
                onClick={() => onCreateTask(msg.content)}
                className="flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-emerald-600 transition-colors px-2 py-1 rounded-md hover:bg-emerald-50"
              >
                <PlusCircle size={12} />
                {t('chat.createTask')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
