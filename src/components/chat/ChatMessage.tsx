import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Share2, BookmarkPlus, Check, ImageIcon, Loader2, GraduationCap, Printer, CalendarPlus, ClipboardList, PlusCircle, Lightbulb, ScanLine, X, Volume2, Square, Pause, Play, SkipForward, Calculator, ListOrdered, Flag, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '../../utils/cn';
import type { Message } from '../../types';

/** Tydlig ram så knapparna under AI-svar känns klickbara */
const ACTION_BTN =
  'inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg border-2 font-medium shadow-sm transition-colors active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none';
const ACTION_FRAME = 'border-stone-400 bg-white text-stone-800 hover:bg-stone-50 dark:border-stone-500 dark:bg-slate-800 dark:text-stone-100 dark:hover:bg-slate-700/90';

interface ChatMessageProps {
  msg: Message;
  generatingImageId: string | null;
  savedMessageIds: Set<string>;
  onShare: (msg: Message) => void;
  onSaveToLibrary: (msg: Message) => void;
  onGenerateImage: (messageId: string, content: string) => void;
  onDeleteOwnMessage?: (messageId: string) => void;
  onAskCurriculum?: (content: string) => void;
  onAskFacitShort?: (content: string) => void;
  onAskFacitSteps?: (content: string) => void;
  onAskFacitParent?: (content: string) => void;
  onAskFordjupning?: (content: string) => void;
  onStartFirstExercise?: () => void;
  onContinueNextExercise?: () => void;
  onAutoCreateTask?: (messageId: string, content: string) => void;
  onAddToPlanner?: (content: string) => void;
  onCreateTask?: (content: string) => void;
  onCreateStudyMaterial?: (content: string) => void;
  hasImage?: boolean;
  creatingAutoTask?: boolean;
  isRequirementsList?: boolean;
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
  onDeleteOwnMessage,
  onAskCurriculum,
  onAskFacitShort,
  onAskFacitSteps,
  onAskFacitParent,
  onAskFordjupning,
  onStartFirstExercise,
  onContinueNextExercise,
  onAutoCreateTask,
  onAddToPlanner,
  onCreateTask,
  onCreateStudyMaterial,
  hasImage,
  creatingAutoTask,
  isRequirementsList,
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

  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const handlePrint = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printTitle = t('chat.printTitle');
    const safeContent = escapeHtml(content);
    const printBody = safeContent
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
        {msg.role === 'user' ? <User size={16} /> : <GraduationCap size={16} />}
      </div>
      <div className={cn('space-y-2', msg.role === 'user' ? 'items-end' : 'items-start')}>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-end max-w-md">
            {msg.attachments.map((att, i) => (
              <img
                key={i}
                src={att}
                alt="Bilaga i chatten"
                className="max-w-[7.5rem] h-24 w-auto object-cover rounded-xl border border-black/5 shadow-sm cursor-zoom-in active:scale-[0.98] transition-transform"
                onClick={() => setZoomedImage(att)}
              />
            ))}
          </div>
        )}
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-[15px] leading-relaxed relative group/msg',
            msg.role === 'user'
              ? 'bg-emerald-600 text-white rounded-tr-none'
              : 'bg-white dark:bg-slate-800 border border-black/5 dark:border-white/5 shadow-sm rounded-tl-none'
          )}
        >
          <div className="markdown-body prose prose-stone prose-sm max-w-none [&_.katex-display]:overflow-x-auto">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
          {msg.role === 'model' && (
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onShare(msg)}
                className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-stone-400 hover:text-emerald-600 transition-all border border-black/5"
                title={t('chat.share')}
                aria-label={t('chat.share')}
              >
                <Share2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => onSaveToLibrary(msg)}
                disabled={savedMessageIds.has(msg.id)}
                className={cn(
                  'p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm transition-all border border-black/5',
                  savedMessageIds.has(msg.id) ? 'text-emerald-600' : 'text-stone-400 hover:text-emerald-600'
                )}
                title={t('chat.saveToLibrary')}
                aria-label={t('chat.saveToLibrary')}
              >
                {savedMessageIds.has(msg.id) ? <Check size={14} /> : <BookmarkPlus size={14} />}
              </button>
            </div>
          )}
          {msg.role === 'user' && onDeleteOwnMessage && (
            <div className="absolute top-2 left-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onDeleteOwnMessage(msg.id)}
                className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-stone-400 hover:text-red-600 transition-all border border-black/5"
                aria-label="Radera meddelande"
                title="Radera meddelande"
              >
                <Trash2 size={14} />
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
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 right-4 p-2 bg-white/20 rounded-full text-white hover:bg-white/40 transition-colors z-10"
              aria-label="Stang bild"
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
          <>
            <div className="mt-1 max-w-2xl rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-100">
              <p className="font-semibold">{t('chat.nextStepTitle')}</p>
              <p className="mt-0.5">{t('chat.nextStepHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
            {hasImage && detectMathType(msg.content) && (
              <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                <Calculator size={11} />
                {t('chat.detectedMathType')}: {detectMathType(msg.content)}
              </span>
            )}
            {speechSupported && speechState && (
              (speechState.isSpeaking || speechState.isPaused) ? (
                <div className="flex flex-wrap items-center gap-1 rounded-lg border-2 border-stone-400 dark:border-stone-500 bg-stone-50/80 dark:bg-slate-800/80 px-1 py-1">
                  <button
                    type="button"
                    onClick={speechState.isSpeaking ? speechState.onPause : speechState.onResume}
                    className={cn(ACTION_BTN, 'border-stone-300 dark:border-stone-600 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500')}
                  >
                    {speechState.isSpeaking ? <Pause size={12} /> : <Play size={12} />}
                    {speechState.isSpeaking ? t('chat.pause') : t('chat.resume')}
                  </button>
                  {speechState.totalChunks > 1 && (
                    <button
                      type="button"
                      onClick={speechState.onNext}
                      className={cn(ACTION_BTN, 'border-stone-300 dark:border-stone-600 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500')}
                    >
                      <SkipForward size={12} />
                      {t('chat.nextChunk')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={speechState.onStop}
                    className={cn(ACTION_BTN, 'border-red-300 dark:border-red-800 bg-white dark:bg-slate-800 text-red-600 hover:border-red-500')}
                  >
                    <Square size={10} />
                  </button>
                  {speechState.totalChunks > 1 && (
                    <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 px-1">
                      {t('chat.chunkProgress', { current: speechState.currentChunk + 1, total: speechState.totalChunks })}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={speechState.onSpeak}
                  title={t('chat.listenHint')}
                  className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-emerald-600 dark:hover:border-emerald-400')}
                >
                  <Volume2 size={12} />
                  {t('chat.listen')}
                </button>
              )
            )}
            {!msg.generatedImage && (
              <button
                type="button"
                onClick={() => onGenerateImage(msg.id, msg.content)}
                disabled={generatingImageId === msg.id}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-emerald-600 dark:hover:border-emerald-400')}
              >
                {generatingImageId === msg.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ImageIcon size={12} />
                )}
                {generatingImageId === msg.id ? t('chat.creatingIllustration') : t('chat.illustrate')}
              </button>
            )}
            {onContinueNextExercise && (
              <button
                type="button"
                onClick={onContinueNextExercise}
                className={cn(
                  ACTION_BTN,
                  'border-blue-600 bg-blue-50 text-blue-900 hover:bg-blue-100 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-100 dark:hover:bg-blue-900/40',
                )}
              >
                <ListOrdered size={12} />
                {t('chat.nextExerciseButton')}
              </button>
            )}
            {onStartFirstExercise && (
              <button
                type="button"
                onClick={onStartFirstExercise}
                className={cn(
                  ACTION_BTN,
                  'border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40',
                )}
              >
                <Flag size={12} />
                {t('chat.firstExerciseButton')}
              </button>
            )}
            {onAskFordjupning && (
              <button
                type="button"
                onClick={() => onAskFordjupning(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-amber-500 dark:hover:border-amber-400 hover:bg-amber-50/90 dark:hover:bg-amber-950/30')}
              >
                <Lightbulb size={12} />
                {t('chat.deepDive')}
              </button>
            )}
            <details className="group/more relative">
              <summary className={cn(ACTION_BTN, ACTION_FRAME, 'cursor-pointer list-none hover:border-stone-600 dark:hover:border-stone-300 [&::-webkit-details-marker]:hidden')}>
                {t('chat.moreSupport')}
                <span className="text-[9px] transition-transform group-open/more:rotate-180">⌄</span>
              </summary>
              <div className="mt-2 flex max-w-2xl flex-wrap gap-2 rounded-2xl border border-stone-200 bg-stone-50/90 p-2 shadow-sm dark:border-white/10 dark:bg-slate-900/90">
            {onAskCurriculum && (
              <button
                type="button"
                onClick={() => onAskCurriculum(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-blue-600 dark:hover:border-blue-400 hover:bg-blue-50/90 dark:hover:bg-blue-950/30')}
              >
                <GraduationCap size={12} />
                {t('chat.curriculumLink')}
              </button>
            )}
            {onAskFacitShort && (
              <button
                type="button"
                onClick={() => onAskFacitShort(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-red-500 dark:hover:border-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/25')}
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeyShort')}
              </button>
            )}
            {onAskFacitSteps && (
              <button
                type="button"
                onClick={() => onAskFacitSteps(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-red-500 dark:hover:border-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/25')}
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeySteps')}
              </button>
            )}
            {onAskFacitParent && (
              <button
                type="button"
                onClick={() => onAskFacitParent(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-red-500 dark:hover:border-red-400 hover:bg-red-50/90 dark:hover:bg-red-950/25')}
              >
                <ClipboardList size={12} />
                {t('chat.showAnswerKeyParent')}
              </button>
            )}
            {isFacitMessage(msg.content) && onAddToPlanner && (
              <button
                type="button"
                onClick={() => onAddToPlanner(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-amber-600 dark:hover:border-amber-400 hover:bg-amber-50/90 dark:hover:bg-amber-950/25')}
              >
                <CalendarPlus size={12} />
                {t('chat.saveAnswerKeyToPlanner')}
              </button>
            )}
            {hasImage && onAutoCreateTask && (
              <button
                type="button"
                onClick={() => onAutoCreateTask(msg.id, msg.content)}
                disabled={creatingAutoTask}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-teal-600 dark:hover:border-teal-400 hover:bg-teal-50/90 dark:hover:bg-teal-950/25')}
              >
                {creatingAutoTask ? <Loader2 size={12} className="animate-spin" /> : <ScanLine size={12} />}
                {creatingAutoTask ? t('chat.creatingTask') : t('chat.createTaskAi')}
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePrint(msg.content)}
              className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-violet-500 dark:hover:border-violet-400 hover:bg-violet-50/90 dark:hover:bg-violet-950/25')}
            >
              <Printer size={12} />
              {t('chat.printAnswer')}
            </button>
            {onAddToPlanner && !isFacitMessage(msg.content) && (
              <button
                type="button"
                onClick={() => onAddToPlanner(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-amber-600 dark:hover:border-amber-400 hover:bg-amber-50/90 dark:hover:bg-amber-950/25')}
              >
                <CalendarPlus size={12} />
                {t('chat.addToPlanner')}
              </button>
            )}
            {onCreateTask && (
              <button
                type="button"
                onClick={() => onCreateTask(msg.content)}
                className={cn(ACTION_BTN, ACTION_FRAME, 'hover:border-emerald-600 dark:hover:border-emerald-400')}
              >
                <PlusCircle size={12} />
                {t('chat.createTask')}
              </button>
            )}
              </div>
            </details>
            {isRequirementsList && onCreateStudyMaterial && (
              <button
                type="button"
                onClick={() => onCreateStudyMaterial(msg.content)}
                className={cn(ACTION_BTN, 'border-emerald-700 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40 font-semibold')}
              >
                <GraduationCap size={12} />
                Skapa komplett läxunderlag
              </button>
            )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
