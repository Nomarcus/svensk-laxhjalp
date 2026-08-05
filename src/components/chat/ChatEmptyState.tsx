import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Camera, CalendarCheck, HeartHandshake } from 'lucide-react';

interface ChatEmptyStateProps {
  childName: string;
  onSendStarter: (text: string) => void;
}

export default function ChatEmptyState({ childName, onSendStarter }: ChatEmptyStateProps) {
  const { t } = useTranslation();

  const starters = [
    t('chatEmpty.starter1'),
    t('chatEmpty.starter2'),
    t('chatEmpty.starter3'),
    t('chatEmpty.starter4'),
    t('chatEmpty.starter5'),
  ];

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-start text-center max-w-md mx-auto py-5 sm:min-h-[420px] sm:justify-center sm:py-12">
      <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-3 shadow-sm ring-1 ring-emerald-200/70 sm:mb-5 sm:h-16 sm:w-16">
        <HeartHandshake size={28} className="sm:h-8 sm:w-8" />
      </div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-semibold mb-1 sm:mb-2 sm:text-xs sm:tracking-[0.24em]">
        {t('chatEmpty.kicker')}
      </p>
      <h2 className="text-xl font-serif italic mb-2 sm:text-2xl">{t('chatEmpty.helpWith', { name: childName })}</h2>
      <p className="text-sm leading-relaxed text-stone-500 mb-4 sm:mb-5 sm:text-base">
        {t('chatEmpty.description', { name: childName })}
      </p>
      <div className="hidden sm:grid sm:grid-cols-3 gap-2 w-full mb-7 text-left">
        <div className="rounded-2xl bg-white border border-black/5 p-3 shadow-sm">
          <BookOpenCheck size={18} className="text-emerald-600 mb-2" />
          <p className="text-xs font-medium text-stone-700">{t('chatEmpty.cardExplain')}</p>
        </div>
        <div className="rounded-2xl bg-white border border-black/5 p-3 shadow-sm">
          <Camera size={18} className="text-emerald-600 mb-2" />
          <p className="text-xs font-medium text-stone-700">{t('chatEmpty.cardPhoto')}</p>
        </div>
        <div className="rounded-2xl bg-white border border-black/5 p-3 shadow-sm">
          <CalendarCheck size={18} className="text-emerald-600 mb-2" />
          <p className="text-xs font-medium text-stone-700">{t('chatEmpty.cardPlan')}</p>
        </div>
      </div>
      <p className="hidden text-stone-400 text-sm mb-4 sm:block">
        {t('chatEmpty.tryClicking')}
      </p>
      <div className="hidden flex-wrap justify-center gap-2 sm:flex">
        {starters.map((starter, i) => (
          <button
            key={i}
            onClick={() => onSendStarter(starter)}
            className="px-4 py-2 bg-white border border-black/5 rounded-xl text-sm text-stone-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
