import React from 'react';
import { BookOpen, MessageSquare, Calendar, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export default function Info() {
  const steps = [
    {
      icon: <MessageSquare className="text-emerald-600" />,
      title: "Interaktiv Läxhjälp",
      description: "Ställ frågor om läxor, be om förklaringar eller träna på glosor. AI:n anpassar sig efter barnets nivå."
    },
    {
      icon: <Calendar className="text-emerald-600" />,
      title: "Smart Planering",
      description: "Lägg in läxor i veckoplaneringen. Du kan se dem i listvy eller kalendervy och enkelt flytta dem med drag-and-drop."
    },
    {
      icon: <Sparkles className="text-emerald-600" />,
      title: "Bildgenerering",
      description: "Gör lärandet roligare! AI:n kan skapa bilder som illustrerar det ni pratar om för att öka förståelsen."
    },
    {
      icon: <ShieldCheck className="text-emerald-600" />,
      title: "Trygg Miljö",
      description: "All data sparas säkert och är endast tillgänglig för dig som förälder. AI:n är instruerad att vara pedagogisk och stöttande."
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0]">
      <div className="max-w-3xl mx-auto space-y-12 py-8">
        <header className="text-center space-y-4">
          <div className="inline-flex p-3 bg-emerald-100 rounded-2xl text-emerald-600 mb-2">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-serif italic text-stone-900">Hur fungerar Läxhjälpen?</h1>
          <p className="text-lg text-stone-600 max-w-xl mx-auto">
            Vår vision är att göra läxläsningen till en lustfylld och lärorik stund för både barn och föräldrar.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step, index) => (
            <div key={index} className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 hover:shadow-md transition-all">
              <div className="w-12 h-12 bg-stone-50 rounded-xl flex items-center justify-center mb-4">
                {step.icon}
              </div>
              <h3 className="text-lg font-medium text-stone-900 mb-2">{step.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        <section className="bg-emerald-600 rounded-[2rem] p-8 md:p-12 text-white overflow-hidden relative">
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-2 text-emerald-200 text-sm font-bold uppercase tracking-widest">
              <Zap size={16} />
              <span>Kom igång snabbt</span>
            </div>
            <h2 className="text-3xl font-serif italic">Tre enkla steg</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold">1</div>
                <p>Lägg till ditt barn i menyn till vänster och ange namn och årskurs.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold">2</div>
                <p>Börja chatta! Prova att skriva "Hjälp mig med multiplikationstabellen" eller "Förklara fotosyntesen".</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold">3</div>
                <p>Använd planeringen för att hålla koll på veckans alla läxor och prov.</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full -ml-24 -mb-24 blur-2xl" />
        </section>

        <footer className="text-center text-stone-400 text-sm pb-8">
          <p>© 2026 Läxhjälpen AI. Skapad för att underlätta vardagen.</p>
        </footer>
      </div>
    </div>
  );
}
