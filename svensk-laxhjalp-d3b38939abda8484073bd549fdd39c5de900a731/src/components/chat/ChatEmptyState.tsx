import { Bot } from 'lucide-react';

interface ChatEmptyStateProps {
  childName: string;
  onSendStarter: (text: string) => void;
}

const starters = [
  'Förklara fotosyntesen enkelt',
  'Hjälp med multiplikationstabellen',
  'Hur skriver man en bra berättelse?',
  'Vad är ett verb?',
  'Berätta om rymden',
];

export default function ChatEmptyState({ childName, onSendStarter }: ChatEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
        <Bot size={32} />
      </div>
      <h2 className="text-2xl font-serif italic mb-2">Hjälp {childName} med läxan</h2>
      <p className="text-stone-500 mb-4">
        Skriv en fråga eller ta ett foto på läxan så förklarar jag hur du kan hjälpa {childName}.
        Du får pedagogiska tips anpassade efter svensk skola — inga färdiga svar, bara stöd för dig som förälder.
      </p>
      <p className="text-stone-400 text-sm mb-8">
        Prova att klicka på ett förslag nedan:
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
