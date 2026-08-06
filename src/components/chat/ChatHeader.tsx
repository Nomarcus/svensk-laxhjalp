import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Plus, Trash2, Languages, Lightbulb } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ChatSession } from '../../types';

interface ChatHeaderProps {
  childName: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onClearChat: () => void;
  simpleSwedish: boolean;
  onToggleSimpleSwedish: () => void;
  coachMode: boolean;
  onToggleCoachMode: () => void;
}

export default function ChatHeader({
  childName,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onClearChat,
  simpleSwedish,
  onToggleSimpleSwedish,
  coachMode,
  onToggleCoachMode,
}: ChatHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="px-4 py-3 md:px-8 md:py-4 bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/5 flex items-center justify-between safe-area-top">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <BookOpenCheck size={18} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-stone-900 dark:text-stone-100">{t('chat.chatWith', { name: childName })}</h2>
            {sessions.length > 1 && (
              <select
                value={activeSessionId || ''}
                onChange={(e) => onSelectSession(e.target.value)}
                className="text-[10px] bg-stone-50 border-none focus:ring-0 py-0 px-1 rounded text-stone-500 cursor-pointer"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <p className="hidden sm:block text-[10px] text-stone-500 uppercase tracking-wider">{t('chat.learningGuide')}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Coach-läge toggle - hidden on mobile */}
        <button
          onClick={onToggleCoachMode}
          aria-pressed={coachMode}
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
            coachMode
              ? "bg-amber-100 text-amber-800 ring-1 ring-amber-300 shadow-sm"
              : "bg-stone-50 text-stone-400 hover:bg-amber-50 hover:text-amber-700"
          )}
          title={t('chat.coachModeTooltip')}
        >
          <Lightbulb size={14} className={coachMode ? 'fill-amber-400' : ''} />
          <span>{t('chat.coachMode')}</span>
        </button>
        {/* Enkel svenska toggle - show icon only on mobile */}
        <button
          onClick={onToggleSimpleSwedish}
          aria-pressed={simpleSwedish}
          className={cn(
            "flex sm:hidden items-center justify-center p-1.5 rounded-xl text-xs font-medium transition-all",
            simpleSwedish
              ? "bg-blue-100 text-blue-700"
              : "bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          )}
          title={t('chat.simpleSwedishTooltip')}
        >
          <Languages size={14} />
        </button>
        <button
          onClick={onToggleSimpleSwedish}
          aria-pressed={simpleSwedish}
          className={cn(
            "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
            simpleSwedish
              ? "bg-blue-100 text-blue-700"
              : "bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          )}
          title={t('chat.simpleSwedishTooltip')}
        >
          <Languages size={14} />
          <span>{t('chat.simpleSwedish')}</span>
        </button>
        {/* New Chat button - show icon only on mobile */}
        <button
          onClick={onNewSession}
          className="flex sm:hidden items-center justify-center p-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-all"
          title={t('chat.newChat')}
        >
          <Plus size={14} />
        </button>
        <button
          onClick={onNewSession}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-medium hover:bg-emerald-100 transition-all"
        >
          <Plus size={14} />
          <span>{t('chat.newChat')}</span>
        </button>
        <button
          onClick={onClearChat}
          className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          title={t('chat.clearChat')}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
