import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';

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
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
        <Bot size={32} />
      </div>
      <h2 className="text-2xl font-serif italic mb-2">{t('chatEmpty.helpWith', { name: childName })}</h2>
      <p className="text-stone-500 mb-4">
        {t('chatEmpty.description', { name: childName })}
      </p>
      <p className="text-stone-400 text-sm mb-8">
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
