import { useTranslation } from 'react-i18next';
import { CalendarDays, Camera, ChevronRight, HeartHandshake, Sparkles } from 'lucide-react';

interface ChatEmptyStateProps {
  childName: string;
  onSendStarter: (text: string) => void;
  onCorrectPhoto: () => void;
  onOpenPlanner?: () => void;
}

export default function ChatEmptyState({ childName, onSendStarter, onCorrectPhoto, onOpenPlanner }: ChatEmptyStateProps) {
  const { t } = useTranslation();

  const actions = [
    {
      id: 'explain',
      Icon: Sparkles,
      title: t('chatEmpty.actionExplainTitle'),
      description: t('chatEmpty.actionExplainDescription'),
      onClick: () => onSendStarter(t('chatEmpty.starter1')),
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
    },
    {
      id: 'correct',
      Icon: Camera,
      title: t('chatEmpty.actionCorrectTitle'),
      description: t('chatEmpty.actionCorrectDescription'),
      onClick: onCorrectPhoto,
      tone: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60',
    },
    ...(onOpenPlanner ? [{
      id: 'plan',
      Icon: CalendarDays,
      title: t('chatEmpty.actionPlanTitle'),
      description: t('chatEmpty.actionPlanDescription'),
      onClick: onOpenPlanner,
      tone: 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
    }] : []),
  ];

  return (
    <div className="mx-auto flex min-h-[300px] w-full max-w-3xl flex-col items-center justify-start py-4 text-center sm:min-h-[430px] sm:justify-center sm:py-10">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm ring-1 ring-emerald-200/70 sm:h-14 sm:w-14">
        <HeartHandshake size={27} />
      </div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs sm:tracking-[0.24em]">
        {t('chatEmpty.kicker')}
      </p>
      <h2 className="mb-2 text-xl font-serif italic text-stone-900 dark:text-stone-100 sm:text-2xl">
        {t('chatEmpty.helpWith', { name: childName })}
      </h2>
      <p className="mb-5 max-w-xl text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
        {t('chatEmpty.description', { name: childName })}
      </p>

      <section className="w-full" aria-labelledby="chat-start-title">
        <h3 id="chat-start-title" className="mb-3 text-left text-sm font-semibold text-stone-800 dark:text-stone-200 sm:text-center">
          {t('chatEmpty.actionHeading')}
        </h3>
        <div className={`grid gap-2.5 ${actions.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {actions.map(({ id, Icon, title, description, onClick, tone }) => (
            <button
              key={id}
              type="button"
              onClick={onClick}
              className="group flex min-h-[92px] items-center gap-3 rounded-2xl border border-black/5 bg-white p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-slate-900 sm:min-h-[150px] sm:flex-col sm:items-start sm:p-4"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone}`}>
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-semibold text-stone-900 dark:text-stone-100">
                  {title}
                  <ChevronRight size={16} className="shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 sm:hidden" />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-stone-500 dark:text-stone-400 sm:mt-1.5 sm:text-sm">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
