import React from 'react';
import { Heart, Clock, Construction, MessageCircle, Image, Palette } from 'lucide-react';

export default function Subscription() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h2 className="text-3xl font-serif italic mb-2">Abonnemang</h2>
          <p className="text-stone-500">Tack för att du testar Läxhjälpen!</p>
        </header>

        {/* Under planering */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600">
              <Construction size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg">Abonnemang under planering</h3>
              <p className="text-sm text-stone-400">Kommer snart!</p>
            </div>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">
            Just nu är Läxhjälpen gratis att testa med begränsad användning. Vi jobbar på abonnemangsplaner
            som ger dig mer användning — de kommer snart!
          </p>
        </div>

        {/* Nuvarande begränsningar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-black/5">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Clock size={18} className="text-emerald-600" />
            Just nu kan du testa
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <MessageCircle size={16} className="text-emerald-600 shrink-0" />
              <span>3 AI-frågor per dag</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <Image size={16} className="text-blue-600 shrink-0" />
              <span>1 bildanalys per dag</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-600">
              <Palette size={16} className="text-purple-600 shrink-0" />
              <span>1 AI-illustration per dag</span>
            </div>
          </div>
        </div>

        {/* Swish-stöd */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-6 shadow-sm border border-emerald-200/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white text-emerald-600 shadow-sm">
              <Heart size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg text-emerald-900">Stötta Läxhjälpen</h3>
              <p className="text-sm text-emerald-700/70">Hjälp oss fortsätta utveckla appen</p>
            </div>
          </div>
          <p className="text-sm text-emerald-800/80 leading-relaxed mb-4">
            Läxhjälpen är ett ideellt projekt som hjälper svenska föräldrar med barnens läxor.
            Om du gillar appen och vill att den ska fortsätta finnas — swisha gärna en valfri summa!
          </p>
          <div className="bg-white rounded-xl p-4 text-center">
            <p className="text-sm text-stone-500 mb-1">Swish</p>
            <p className="text-2xl font-bold text-emerald-700 tracking-wider">Kommer snart</p>
            <p className="text-xs text-stone-400 mt-1">Swish-nummer läggs till inom kort</p>
          </div>
        </div>
      </div>
    </div>
  );
}
