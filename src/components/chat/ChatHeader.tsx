import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Check, History, Plus, Trash2, Languages, Lightbulb } from 'lucide-react';
import { cn } from '../../utils/cn';
import { gradeLabel } from '../../utils/grade';
import type { ChatSession } from '../../types';

interface ChatHeaderProps {
  childName: string;
  childGrade?: string;
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

/**
 * Av/på-reglage. Lägesknapparna såg tidigare ut som gråa, avstängda knappar när
 * läget var av, så det framgick inte att de gick att slå på.
 */
function ModeToggle({
  on,
  onClick,
  icon,
  label,
  title,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  tone: 'amber' | 'blue';
}) {
  const onColors = tone === 'amber'
    ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100'
    : 'border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-100';
  const track = tone === 'amber' ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      title={title}
      aria-label={label}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors',
        on
          ? onColors
          : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-600 dark:bg-slate-900 dark:text-stone-200',
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span
        aria-hidden="true"
        className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors', on ? track : 'bg-stone-300 dark:bg-stone-600')}
      >
        <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all', on ? 'left-3.5' : 'left-0.5')} />
      </span>
    </button>
  );
}

export default function ChatHeader({
  childName,
  childGrade,
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
  const { t, i18n } = useTranslation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!historyOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [historyOpen]);

  const formatDate = (s: ChatSession) => {
    const d = s.createdAt?.toDate?.();
    return d ? d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }) : '';
  };

  return (
    // På mobil ligger knapparna på en egen rad: annars kortades rubriken till "Läxg…".
    <div className="px-4 py-3 md:px-8 md:py-4 bg-white dark:bg-slate-900 border-b border-black/5 dark:border-white/5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 safe-area-top">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-8 h-8 shrink-0 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <BookOpenCheck size={18} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{t('chat.chatWith', { name: childName })}</h2>
          <p className="truncate text-xs text-stone-500 dark:text-stone-400">{childGrade ? gradeLabel(childGrade, t) : t('chat.learningGuide')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
        <ModeToggle
          on={coachMode}
          onClick={onToggleCoachMode}
          icon={<Lightbulb size={14} className={cn('shrink-0', coachMode && 'fill-amber-400')} />}
          label={t('chat.coachMode')}
          title={t('chat.coachModeTooltip')}
          tone="amber"
        />
        <ModeToggle
          on={simpleSwedish}
          onClick={onToggleSimpleSwedish}
          icon={<Languages size={14} className="shrink-0" />}
          label={t('chat.simpleSwedish')}
          title={t('chat.simpleSwedishTooltip')}
          tone="blue"
        />

        {/* Tidigare chattar låg i en rullgardin med 10 punkters text och var i
            praktiken svåra att hitta. Rensa ligger här i stället för bredvid
            "Ny chatt", där ett felklick låg nära till hands. */}
        <div ref={historyRef} className="relative">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            aria-haspopup="true"
            title={t('chat.history')}
            aria-label={t('chat.history')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-stone-400 dark:border-stone-600 dark:bg-slate-900 dark:text-stone-200"
          >
            <History size={15} className="shrink-0" />
            <span className="hidden sm:inline">{t('chat.history')}</span>
            {sessions.length > 1 && <span className="tabular-nums text-stone-400">{sessions.length}</span>}
          </button>
          {historyOpen && (
            <div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900">
              <p className="border-b border-black/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:border-white/5 dark:text-stone-400">
                {t('chat.history')}
              </p>
              <ul className="max-h-72 overflow-y-auto py-1">
                {sessions.map((s) => {
                  const active = s.id === activeSessionId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSession(s.id);
                          setHistoryOpen(false);
                        }}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors',
                          active
                            ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                            : 'text-stone-800 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-slate-800',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <span className="shrink-0 text-xs text-stone-400">{formatDate(s)}</span>
                        {active && <Check size={14} className="shrink-0 text-emerald-600" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setHistoryOpen(false);
                  onClearChat();
                }}
                className="flex w-full items-center gap-2 border-t border-black/5 px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-white/5 dark:hover:bg-red-950/30"
              >
                <Trash2 size={15} className="shrink-0" />
                {t('chat.clearThisChat')}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onNewSession}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          title={t('chat.newChat')}
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('chat.newChat')}</span>
        </button>
      </div>
    </div>
  );
}
