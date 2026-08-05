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
    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-5 shadow-sm ring-1 ring-emerald-200/70">
        <HeartHandshake size={32} />
      </div>
      <p className="text-xs uppercase tracking-[0.24em] text-emerald-700 font-semibold mb-2">
        {t('chatEmpty.kicker')}
      </p>
      <h2 className="text-2xl font-serif italic mb-2">{t('chatEmpty.helpWith', { name: childName })}</h2>
      <p className="text-stone-500 mb-5">
        {t('chatEmpty.description', { name: childName })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full mb-7 text-left">
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
      <p className="text-stone-400 text-sm mb-4">
        {t('chatEmpty.tryClicking')}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
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
