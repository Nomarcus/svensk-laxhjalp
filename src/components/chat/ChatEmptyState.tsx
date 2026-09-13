import { useTranslation } from 'react-i18next';
import { CalendarDays, Camera, HeartHandshake, Image as ImageIcon } from 'lucide-react';

interface ChatEmptyStateProps {
  childName: string;
  onTakePhoto: () => void;
  onChooseImage: () => void;
  onOpenPlanner?: () => void;
}

export default function ChatEmptyState({ childName, onTakePhoto, onChooseImage, onOpenPlanner }: ChatEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex min-h-[300px] w-full max-w-xl flex-col items-center justify-start py-4 text-center sm:min-h-[430px] sm:justify-center sm:py-10">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm ring-1 ring-emerald-200/70 sm:h-14 sm:w-14">
        <HeartHandshake size={27} />
      </div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs sm:tracking-[0.24em]">
        {t('chatEmpty.kicker')}
      </p>
      <h2 className="mb-2 text-xl font-serif italic text-stone-900 dark:text-stone-100 sm:text-2xl">
        {t('chatEmpty.helpWith', { name: childName })}
      </h2>
      <p className="mb-5 max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
        {t('chatEmpty.description', { name: childName })}
      </p>

      <section className="w-full rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-left shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/25 sm:p-5" aria-labelledby="homework-help-title">
        <h3 id="homework-help-title" className="text-base font-semibold text-stone-900 dark:text-stone-100">
          {t('chatEmpty.homeworkHelpTitle')}
        </h3>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {t('chatEmpty.homeworkHelpDescription')}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onTakePhoto} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">
            <Camera size={19} />
            {t('chat.takePhoto')}
          </button>
          <button type="button" onClick={onChooseImage} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-100 dark:hover:bg-emerald-950/50">
            <ImageIcon size={19} />
            {t('chat.chooseImage')}
          </button>
        </div>
      </section>

      {onOpenPlanner && (
        <button type="button" onClick={onOpenPlanner} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-stone-300 dark:hover:bg-slate-800">
          <CalendarDays size={18} />
          {t('chatEmpty.openPlanner')}
        </button>
      )}
    </div>
  );
}
