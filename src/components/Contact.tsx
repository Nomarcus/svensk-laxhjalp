import React, { useState } from 'react';
import { Mail, Send, MessageCircle, Lightbulb, Bug } from 'lucide-react';

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(false);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setSent(true);
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0] dark:bg-slate-950">
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center">
          <h2 className="text-3xl font-serif italic mb-2 dark:text-stone-100">Kontakta oss</h2>
          <p className="text-stone-500 dark:text-stone-400">Vi vill gärna höra från dig!</p>
        </header>

        {/* Förklarande text */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4">
            Föräldrahjälpen är ett projekt som ständigt utvecklas. Din feedback hjälper oss att göra appen bättre
            för alla svenska föräldrar. Hör av dig om du har frågor, idéer eller stöter på problem.
          </p>
          <div className="space-y-3">
            {[
              { icon: <Lightbulb size={16} />, text: 'Förslag på nya funktioner eller förbättringar' },
              { icon: <Bug size={16} />, text: 'Rapportera problem eller fel i appen' },
              { icon: <MessageCircle size={16} />, text: 'Frågor om hur appen fungerar' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-emerald-600 dark:text-emerald-400">{item.icon}</span>
                <span className="text-sm text-stone-600 dark:text-stone-300">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Formulär */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Mail size={24} />
            </div>
            <div>
              <h3 className="font-medium text-lg dark:text-stone-100">Skicka meddelande</h3>
              <p className="text-sm text-stone-400">Vi svarar så snart vi kan</p>
            </div>
          </div>

          {sent ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-6 text-center">
              <p className="font-medium mb-1">Tack för ditt meddelande!</p>
              <p className="text-emerald-600/70 dark:text-emerald-400/70">Vi återkommer så snart vi kan.</p>
              <button
                onClick={() => setSent(false)}
                className="mt-4 text-sm text-emerald-600 dark:text-emerald-400 underline hover:no-underline"
              >
                Skicka ett nytt meddelande
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 text-center">
                  Något gick fel. Försök igen eller maila direkt till marcus.mpai@gmail.com
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 ml-1">Ditt namn</label>
                <input
                  type="text"
                  placeholder="Förnamn Efternamn"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/50 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 ml-1">Din e-post</label>
                <input
                  type="email"
                  placeholder="namn@exempel.se"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/50 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1 ml-1">Meddelande</label>
                <textarea
                  placeholder="Beskriv din fråga, idé eller problem..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-stone-700 dark:text-stone-200 placeholder:text-stone-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/50 outline-none transition-all text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50 text-sm"
              >
                <Send size={16} />
                {sending ? 'Skickar...' : 'Skicka meddelande'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-stone-400 dark:text-stone-500">
          Du kan också nå oss direkt på <span className="font-medium text-stone-500 dark:text-stone-400">marcus.mpai@gmail.com</span>
        </p>
      </div>
    </div>
  );
}
