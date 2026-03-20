import React from 'react';
import { BookOpen, LogIn } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

export default function Auth() {
  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-black/5 text-center relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
        
        <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-emerald-200">
          <BookOpen size={40} />
        </div>

        <h1 className="text-4xl font-serif italic text-stone-900 mb-4">Svensk Läxhjälp</h1>
        <p className="text-stone-500 mb-12 leading-relaxed">
          Ett pedagogiskt stöd för föräldrar som vill hjälpa sina barn att lyckas i skolan.
        </p>

        <button
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-4 px-6 rounded-2xl font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98]"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" alt="Google" className="w-5 h-5" />
          Logga in med Google
        </button>

        <div className="mt-12 pt-8 border-t border-black/5 grid grid-cols-2 gap-4">
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Pedagogiskt</p>
            <p className="text-xs text-stone-500">Stöd för föräldrar, inte fusk för elever.</p>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Svensk Skola</p>
            <p className="text-xs text-stone-500">Anpassat efter svensk läroplan.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
