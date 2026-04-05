import React from 'react';
import { Heart, Construction, MessageCircle, Image, Palette, BookOpen, Sparkles, FileText } from 'lucide-react';

export default function Subscription() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h2 className="text-3xl font-serif italic mb-2 dark:text-stone-100">Abonnemang</h2>
          <p className="text-stone-500 dark:text-stone-400">Tack för att du testar Föräldrahjälpen!</p>
        </header>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              <Construction size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg dark:text-stone-100">Abonnemang under planering</h3>
              <p className="text-sm text-stone-400">Kommer snart!</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            Just nu är Föräldrahjälpen gratis att använda utan dagliga gränser. Vi jobbar på abonnemangsplaner
            som kan ge extra funktioner — de kommer snart!
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <h3 className="font-medium mb-4 flex items-center gap-2 dark:text-stone-100">
            <Sparkles size={18} className="text-emerald-600 dark:text-emerald-400" />
            Vad som ingår nu
          </h3>
          <div className="space-y-3">
            {[
              { icon: <MessageCircle size={14} />, text: 'AI-frågor och stöd', sub: 'Hjälp med läxor, förklaringar och tips' },
              { icon: <Image size={14} />, text: 'Bildanalys', sub: 'Fotografera läxan och få hjälp direkt' },
              { icon: <Palette size={14} />, text: 'AI-illustrationer', sub: 'Visuella förklaringar av svåra begrepp' },
              { icon: <BookOpen size={14} />, text: 'Koppling till läroplanen', sub: 'Se hur läxan kopplar till Lgr22' },
              { icon: <FileText size={14} />, text: 'Facit, studieplan & provförberedelse', sub: 'Planera och förbered inför prov' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{item.text}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-900/10 rounded-2xl p-6 shadow-sm border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm">
              <Heart size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg text-emerald-900 dark:text-emerald-300">Stötta Föräldrahjälpen</h3>
              <p className="text-sm text-emerald-700/70 dark:text-emerald-400/70">Hjälp oss fortsätta utveckla appen</p>
            </div>
          </div>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed mb-4">
            Föräldrahjälpen är ett ideellt projekt som hjälper svenska föräldrar med barnens läxor.
            Om du gillar appen och vill att den ska fortsätta finnas — swisha gärna en valfri summa!
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-1">Swish</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">Kommer snart</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">Swish-nummer läggs till inom kort</p>
          </div>
        </div>
      </div>
    </div>
  );
}
