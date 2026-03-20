import React, { useState } from 'react';
import { BookOpen, Mail, Eye, EyeOff, ArrowLeft, UserCircle } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, signInAsGuest, resetPassword } from '../firebase';

interface AuthProps {
  onShowPrivacy?: () => void;
}

type AuthView = 'main' | 'email-login' | 'email-signup' | 'reset-password';

export default function Auth({ onShowPrivacy }: AuthProps) {
  const [view, setView] = useState<AuthView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError('');
    setShowPassword(false);
    setResetSent(false);
  };

  const goTo = (v: AuthView) => {
    clearForm();
    setView(v);
  };

  const handleError = (err: any) => {
    const code = err?.code || '';
    const map: Record<string, string> = {
      'auth/email-already-in-use': 'E-postadressen används redan. Försök logga in istället.',
      'auth/invalid-email': 'Ogiltig e-postadress.',
      'auth/weak-password': 'Lösenordet måste vara minst 6 tecken.',
      'auth/user-not-found': 'Ingen användare hittades med den e-postadressen.',
      'auth/wrong-password': 'Fel lösenord. Försök igen.',
      'auth/invalid-credential': 'Fel e-post eller lösenord. Försök igen.',
      'auth/too-many-requests': 'För många försök. Vänta en stund och försök igen.',
      'auth/popup-closed-by-user': 'Inloggningen avbröts.',
    };
    setError(map[code] || 'Något gick fel. Försök igen.');
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, password, displayName || undefined);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAsGuest();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const backButton = (
    <button
      onClick={() => goTo('main')}
      className="absolute top-6 left-6 p-2 rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
    >
      <ArrowLeft size={20} />
    </button>
  );

  const errorBox = error && (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
      {error}
    </div>
  );

  if (view === 'reset-password') {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
          {backButton}

          <div className="mt-4 text-center mb-8">
            <h2 className="text-2xl font-serif italic text-stone-900 mb-2">Återställ lösenord</h2>
            <p className="text-stone-500 text-sm">Ange din e-post så skickar vi en länk.</p>
          </div>

          {errorBox}

          {resetSent ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 text-center">
              Återställningslänk har skickats till <strong>{email}</strong>. Kolla din inkorg!
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="email"
                placeholder="E-postadress"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Skickar...' : 'Skicka återställningslänk'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (view === 'email-login' || view === 'email-signup') {
    const isSignup = view === 'email-signup';
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
          {backButton}

          <div className="mt-4 text-center mb-8">
            <h2 className="text-2xl font-serif italic text-stone-900 mb-2">
              {isSignup ? 'Skapa konto' : 'Logga in med e-post'}
            </h2>
            <p className="text-stone-500 text-sm">
              {isSignup ? 'Fyll i dina uppgifter nedan.' : 'Ange din e-post och lösenord.'}
            </p>
          </div>

          {errorBox}

          <form onSubmit={isSignup ? handleEmailSignup : handleEmailLogin} className="space-y-4">
            {isSignup && (
              <input
                type="text"
                placeholder="Namn (valfritt)"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700"
              />
            )}
            <input
              type="email"
              placeholder="E-postadress"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Lösenord"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Vänta...' : isSignup ? 'Skapa konto' : 'Logga in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-500">
            {isSignup ? (
              <p>
                Har du redan ett konto?{' '}
                <button onClick={() => goTo('email-login')} className="text-emerald-600 hover:underline font-medium">
                  Logga in
                </button>
              </p>
            ) : (
              <>
                <p>
                  Inget konto?{' '}
                  <button onClick={() => goTo('email-signup')} className="text-emerald-600 hover:underline font-medium">
                    Skapa konto
                  </button>
                </p>
                <button
                  onClick={() => goTo('reset-password')}
                  className="mt-2 text-stone-400 hover:text-emerald-600 hover:underline text-xs"
                >
                  Glömt lösenord?
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[32px] p-12 shadow-sm border border-black/5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />

        <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-emerald-200">
          <BookOpen size={40} />
        </div>

        <h1 className="text-4xl font-serif italic text-stone-900 mb-4">Svensk Läxhjälp</h1>
        <p className="text-stone-500 mb-10 leading-relaxed">
          Ett pedagogiskt stöd för föräldrar som vill hjälpa sina barn att lyckas i skolan.
        </p>

        {errorBox}

        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-4 px-6 rounded-2xl font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Logga in med Google
          </button>

          {/* Email */}
          <button
            onClick={() => goTo('email-login')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-4 px-6 rounded-2xl font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
          >
            <Mail size={20} className="text-emerald-600" />
            Logga in med e-post
          </button>

          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400 uppercase tracking-wider">eller</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-stone-50 border border-stone-150 py-3 px-6 rounded-2xl text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <UserCircle size={18} />
            Fortsätt som gäst
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-black/5 grid grid-cols-2 gap-4">
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Pedagogiskt</p>
            <p className="text-xs text-stone-500">Stöd för föräldrar, inte fusk för elever.</p>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Svensk Skola</p>
            <p className="text-xs text-stone-500">Anpassat efter svensk läroplan.</p>
          </div>
        </div>
        {onShowPrivacy && (
          <p className="mt-6 text-xs text-stone-400">
            Genom att logga in godkänner du vår{' '}
            <button onClick={onShowPrivacy} className="underline hover:text-emerald-600 transition-colors">
              integritetspolicy
            </button>.
          </p>
        )}
      </div>
    </div>
  );
}
