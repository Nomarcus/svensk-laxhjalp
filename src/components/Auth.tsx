import React, { useState, useEffect } from 'react';
import { BookOpen, Mail, Eye, EyeOff, ArrowLeft, MessageSquare, Camera, Calendar, Sparkles, Library, CheckCircle, ChevronLeft, ChevronRight, Shield, GraduationCap, Users, Star, FileText, Moon, Sun } from 'lucide-react';
import { auth, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signInAsGuest, linkGuestWithGoogle, linkGuestWithEmail } from '../firebase';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';

interface AuthProps {
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
  redirectError?: unknown;
}

type AuthView = 'main' | 'email-login' | 'email-signup' | 'reset-password';

function AppSlideshow() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const slides = [
    {
      title: t('slideshow.slide1Title'),
      description: t('slideshow.slide1Desc'),
      image: "/screenshots/chat.png",
      color: "from-emerald-500 to-emerald-700",
    },
    {
      title: t('slideshow.slide2Title'),
      description: t('slideshow.slide2Desc'),
      image: "/screenshots/explanation.png",
      color: "from-blue-500 to-blue-700",
    },
    {
      title: t('slideshow.slide3Title'),
      description: t('slideshow.slide3Desc'),
      image: "/screenshots/planner.png",
      color: "from-amber-500 to-amber-700",
    },
    {
      title: t('slideshow.slide4Title'),
      description: t('slideshow.slide4Desc'),
      image: "/screenshots/illustration.png",
      color: "from-purple-500 to-purple-700",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(c => (c + 1) % slides.length);
        setIsTransitioning(false);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const goTo = (index: number) => {
    if (index === current) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setIsTransitioning(false);
    }, 300);
  };

  const slide = slides[current];

  return (
    <div className="relative">
      {/* Screenshot card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl surface-card overflow-hidden dark:border dark:border-white/10">
        {/* Image area */}
        <div className="relative overflow-hidden bg-stone-100 dark:bg-slate-800">
          <img
            src={slide.image}
            alt={slide.title}
            className={`w-full h-[280px] md:h-[380px] object-cover object-top transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'}`}
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent dark:from-slate-900 dark:to-transparent" />
        </div>
        {/* Caption */}
        <div className={`px-6 pb-5 pt-2 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${slide.color}`} />
            <h3 className="text-lg font-serif italic text-stone-900 dark:text-stone-100">{slide.title}</h3>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{slide.description}</p>
        </div>
      </div>
      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-3 mt-5">
        <button onClick={() => goTo((current - 1 + slides.length) % slides.length)} className="p-1.5 rounded-full text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all">
          <ChevronLeft size={20} />
        </button>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-emerald-600 w-6' : 'bg-stone-300 dark:bg-slate-600 hover:bg-stone-400 dark:hover:bg-slate-500 w-2'}`}
          />
        ))}
        <button onClick={() => goTo((current + 1) % slides.length)} className="p-1.5 rounded-full text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default function Auth({ onShowPrivacy, onShowTerms, dark, onToggleDark, redirectError }: AuthProps) {
  const { t, i18n } = useTranslation();
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

  const handleError = (err: unknown) => {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
    console.error('[auth] Sign-in failed', { code });
    const map: Record<string, string> = {
      'auth/email-already-in-use': t('authErrors.emailInUse'),
      'auth/invalid-email': t('authErrors.invalidEmail'),
      'auth/weak-password': t('authErrors.weakPassword'),
      'auth/user-not-found': t('authErrors.userNotFound'),
      'auth/wrong-password': t('authErrors.wrongPassword'),
      'auth/invalid-credential': t('authErrors.invalidCredential'),
      'auth/too-many-requests': t('authErrors.tooManyRequests'),
      'auth/popup-closed-by-user': t('authErrors.popupClosed'),
      'auth/popup-blocked': t('authErrors.popupBlocked'),
      'auth/operation-not-allowed': t('authErrors.providerNotEnabled'),
      'auth/unauthorized-domain': t('authErrors.unauthorizedDomain'),
      'auth/account-exists-with-different-credential': t('authErrors.accountExistsDifferentProvider'),
      'auth/network-request-failed': t('authErrors.networkRequestFailed'),
      'auth/internal-error': t('authErrors.internalError'),
      'auth/cancelled-popup-request': t('authErrors.popupClosed'),
      'auth/web-storage-unsupported': t('authErrors.webStorageUnsupported'),
      'auth/credential-unavailable': t('authErrors.credentialUnavailable'),
      'auth/configuration-not-found': t('authErrors.configurationNotFound'),
    };
    setError(map[code] || t('authErrors.generic'));
  };

  useEffect(() => {
    if (redirectError) handleError(redirectError);
  }, [redirectError, i18n.language]);

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
      setError(t('authErrors.weakPassword'));
      return;
    }
    setLoading(true);
    try {
      if (auth.currentUser?.isAnonymous) {
        await linkGuestWithEmail(email, password, displayName || undefined);
      } else {
        await signUpWithEmail(email, password, displayName || undefined);
      }
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

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      if (auth.currentUser?.isAnonymous) {
        await linkGuestWithGoogle();
      } else {
        await signInWithGoogle();
      }
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

  const backButton = (
    <button
      onClick={() => goTo('main')}
      className="absolute top-6 left-6 p-2 rounded-xl text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all"
    >
      <ArrowLeft size={20} />
    </button>
  );

  const errorBox = error && (
    <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3 mb-4">
      {error}
    </div>
  );

  if (view === 'reset-password') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#F7F7F2] via-[#F5F5F0] to-[#EFF7F2] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-start justify-center pt-[12vh] md:pt-[15vh] p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-12 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.32)] border border-black/[0.06] dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
          {backButton}
          <div className="mt-4 text-center mb-8">
            <h2 className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-2">{t('auth.resetPassword')}</h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm">{t('auth.resetDescription')}</p>
          </div>
          {errorBox}
          {resetSent ? (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-3 text-center">
              <Trans i18nKey="auth.resetSent" values={{ email }} components={{ strong: <strong /> }} />
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <input type="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 outline-none transition-all text-stone-700 dark:text-stone-100" />
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50">
                {loading ? t('auth.sending') : t('auth.sendResetLink')}
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
      <div className="min-h-screen bg-gradient-to-b from-[#F7F7F2] via-[#F5F5F0] to-[#EFF7F2] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-start justify-center pt-[12vh] md:pt-[15vh] p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[32px] p-8 md:p-12 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.32)] border border-black/[0.06] dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />
          {backButton}
          <div className="mt-4 text-center mb-8">
            <h2 className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-2">
              {isSignup ? t('auth.createAccount') : t('auth.loginEmail')}
            </h2>
            <p className="text-stone-500 dark:text-stone-400 text-sm">
              {isSignup ? t('auth.fillDetails') : t('auth.enterCredentials')}
            </p>
          </div>
          {errorBox}
          <form onSubmit={isSignup ? handleEmailSignup : handleEmailLogin} className="space-y-4">
            {isSignup && (
              <input type="text" placeholder={t('auth.name')} value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 outline-none transition-all text-stone-700 dark:text-stone-100" />
            )}
            <input type="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 outline-none transition-all text-stone-700 dark:text-stone-100" />
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} placeholder={t('auth.password')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/40 outline-none transition-all text-stone-700 dark:text-stone-100 pr-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50">
              {loading ? t('auth.waiting') : isSignup ? t('auth.createAccount') : t('auth.login')}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-stone-500 dark:text-stone-400">
            {isSignup ? (
              <p>{t('auth.hasAccount')}{' '}<button onClick={() => goTo('email-login')} className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">{t('auth.login')}</button></p>
            ) : (
              <>
                <p>{t('auth.noAccount')}{' '}<button onClick={() => goTo('email-signup')} className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">{t('auth.createAccount')}</button></p>
                <button onClick={() => goTo('reset-password')} className="mt-2 text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline text-xs">{t('auth.forgotPassword')}</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main landing page view
  return (
    <div className="min-h-screen app-soft-bg font-sans relative overflow-hidden text-stone-900 dark:text-stone-100">
      <div className="pointer-events-none absolute -top-32 -right-24 h-80 w-80 rounded-full bg-emerald-200/30 dark:bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-blue-200/20 dark:bg-blue-500/10 blur-3xl" />
      {/* Hero section with login */}
      <div className="relative landing-hero-grid min-h-screen">
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/80 dark:bg-slate-800/90 border border-black/5 dark:border-white/10 text-stone-600 dark:text-stone-300 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-all"
              title={dark ? t('nav.lightMode') : t('nav.darkMode')}
              aria-label={dark ? t('nav.lightMode') : t('nav.darkMode')}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          <LanguageSwitcher />
        </div>
        {i18n.language === 'ar' && (
          <div className="absolute top-16 left-4 right-4 z-10 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
            <span>⚠️</span>
            {t('language.betaNotice')}
          </div>
        )}
        {/* Brand + headline: shown first on every breakpoint */}
        <div className="landing-hero-brand flex flex-col justify-center p-6 md:p-10 lg:p-14 xl:p-20 lg:pb-0">
          <div className="max-w-lg mx-auto w-full lg:mx-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <BookOpen size={22} />
              </div>
              <span className="text-lg font-serif italic text-stone-900 dark:text-stone-100 drop-shadow-[0_2px_6px_rgba(15,23,42,0.12)]">{t('app.fullName')}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-serif italic text-stone-900 dark:text-stone-100 leading-tight drop-shadow-[0_4px_14px_rgba(15,23,42,0.18)]">
              {t('landing.heroTitle')}
            </h1>
          </div>
        </div>

        {/* Login card: shown right after the headline, before the story/badges/features */}
        <div className="landing-hero-login flex items-center justify-center p-6 md:p-10 lg:p-14 xl:p-20 bg-gradient-to-br from-white/70 via-white/40 to-emerald-50/40 dark:from-slate-900/80 dark:via-slate-900/50 dark:to-emerald-950/30">
          <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-[32px] p-10 surface-card-strong text-center relative overflow-hidden dark:border dark:border-white/10">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />

            <h2 className="text-2xl font-serif italic text-stone-900 dark:text-stone-100 mb-2 mt-2">{t('auth.getStarted')}</h2>
            <p className="text-stone-500 dark:text-stone-400 mb-8 text-sm">
              {t('auth.createFreeAccount')}
            </p>

            {errorBox}

            <div className="space-y-3">
              <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-600 py-4 px-6 rounded-2xl font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700 hover:border-stone-300 dark:hover:border-slate-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {t('auth.loginGoogle')}
              </button>
              <button onClick={() => goTo('email-login')} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-600 py-4 px-6 rounded-2xl font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-slate-700 hover:border-stone-300 dark:hover:border-slate-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                <Mail size={20} className="text-emerald-600" />
                {t('auth.loginEmail')}
              </button>
              <button onClick={handleGuestLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 py-4 px-6 rounded-2xl font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 dark:focus-visible:ring-emerald-800 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                <Users size={20} className="text-emerald-700" />
                {t('auth.loginGuest')}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-black/5 dark:border-white/10 grid grid-cols-2 gap-4">
              <div className="text-left">
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{t('landing.pedagogical')}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t('landing.pedagogicalDesc')}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">{t('landing.swedishSchool')}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{t('landing.swedishSchoolDesc')}</p>
              </div>
            </div>
            {(onShowPrivacy || onShowTerms) && (
              <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
                {t('auth.termsConsent')}{' '}
                {onShowTerms && <button onClick={onShowTerms} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{t('auth.termsOfService')}</button>}
                {onShowTerms && onShowPrivacy && ` ${t('auth.and')} `}
                {onShowPrivacy && <button onClick={onShowPrivacy} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{t('auth.privacyPolicy')}</button>}.
              </p>
            )}
          </div>
        </div>

        {/* Story + badges + features: shown after the login card */}
        <div className="landing-hero-story flex flex-col justify-center p-6 md:p-10 lg:p-14 xl:p-20 lg:pt-0">
          <div className="max-w-lg mx-auto w-full lg:mx-0">
            <div className="mb-6 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/40 px-4 py-3 shadow-[0_12px_26px_-20px_rgba(5,150,105,0.5)]">
              <div className="mb-1 flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <FileText size={16} />
                <span className="text-sm font-semibold">{t('landing.missionTitle')}</span>
              </div>
              <p className="text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/90">
                {t('landing.missionText')}
              </p>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/85 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-100 dark:border-emerald-800/50 shadow-[0_8px_20px_-14px_rgba(5,150,105,0.45)]">
                <CheckCircle size={14} /> {t('landing.freeToStart')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/85 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-100 dark:border-blue-800/50 shadow-[0_8px_20px_-14px_rgba(37,99,235,0.45)]">
                <GraduationCap size={14} /> {t('landing.linkedToLgr22')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50/85 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-100 dark:border-amber-800/50 shadow-[0_8px_20px_-14px_rgba(217,119,6,0.45)]">
                <Shield size={14} /> {t('landing.safeAndSecure')}
              </span>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <MessageSquare size={16} />, text: t('landing.featureAiHelp') },
                { icon: <Camera size={16} />, text: t('landing.featurePhoto') },
                { icon: <Calendar size={16} />, text: t('landing.featurePlanner') },
                { icon: <Users size={16} />, text: t('landing.featureShare') },
                { icon: <Sparkles size={16} />, text: t('landing.featureIllustrations') },
                { icon: <Library size={16} />, text: t('landing.featureLibrary') },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                  <span className="text-emerald-600 dark:text-emerald-400">{f.icon}</span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Below-the-fold marketing content */}
      <div className="max-w-5xl mx-auto px-6 pb-20 space-y-20">

        {/* App slideshow */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100 text-center mb-8">{t('landing.seeHowItWorks')}</h2>
          <AppSlideshow />
        </section>

        {/* How it works */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100 text-center mb-3">{t('landing.howWeHelp')}</h2>
          <p className="text-center text-stone-500 dark:text-stone-400 mb-10 max-w-2xl mx-auto">
            {t('landing.howWeHelpDesc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: t('landing.step1Title'),
                desc: t('landing.step1Desc'),
                icon: <Camera size={24} className="text-emerald-600" />,
              },
              {
                step: "2",
                title: t('landing.step2Title'),
                desc: t('landing.step2Desc'),
                icon: <MessageSquare size={24} className="text-emerald-600" />,
              },
              {
                step: "3",
                title: t('landing.step3Title'),
                desc: t('landing.step3Desc'),
                icon: <Calendar size={24} className="text-emerald-600" />,
              },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-8 surface-card text-center dark:border dark:border-white/10">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2">{t('landing.step')} {s.step}</div>
                <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">{s.title}</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Subjects supported */}
        <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-12 surface-card dark:border dark:border-white/10">
          <h2 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100 text-center mb-3">{t('landing.allSubjects')}</h2>
          <p className="text-center text-stone-500 dark:text-stone-400 mb-8 max-w-2xl mx-auto">
            {t('landing.allSubjectsDesc')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { subject: t('landing.subjectMath'), examples: t('landing.subjectMathEx') },
              { subject: t('landing.subjectSwedish'), examples: t('landing.subjectSwedishEx') },
              { subject: t('landing.subjectEnglish'), examples: t('landing.subjectEnglishEx') },
              { subject: t('landing.subjectScience'), examples: t('landing.subjectScienceEx') },
              { subject: t('landing.subjectSocial'), examples: t('landing.subjectSocialEx') },
              { subject: t('landing.subjectLanguages'), examples: t('landing.subjectLanguagesEx') },
              { subject: t('landing.subjectArts'), examples: t('landing.subjectArtsEx') },
              { subject: t('landing.subjectPE'), examples: t('landing.subjectPEEx') },
            ].map((s, i) => (
              <div key={i} className="bg-stone-50/95 dark:bg-slate-800/90 rounded-2xl p-4 border border-stone-200/70 dark:border-white/10 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.25)]">
                <h3 className="font-medium text-stone-900 dark:text-stone-100 mb-1">{s.subject}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">{s.examples}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why parents need help */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100 text-center mb-3">{t('landing.whyParentsNeedHelp')}</h2>
          <p className="text-center text-stone-500 dark:text-stone-400 mb-10 max-w-2xl mx-auto">
            {t('landing.whyParentsDesc')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: t('landing.reason1Title'),
                desc: t('landing.reason1Desc'),
                icon: <GraduationCap size={20} className="text-emerald-600" />,
              },
              {
                title: t('landing.reason2Title'),
                desc: t('landing.reason2Desc'),
                icon: <Star size={20} className="text-emerald-600" />,
              },
              {
                title: t('landing.reason4Title'),
                desc: t('landing.reason4Desc'),
                icon: <Shield size={20} className="text-emerald-600" />,
              },
            ].map((item, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 surface-card dark:border dark:border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl flex items-center justify-center">{item.icon}</div>
                  <h3 className="font-medium text-stone-900 dark:text-stone-100">{item.title}</h3>
                </div>
                <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Free to use + support */}
        <section className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-12 surface-card text-center dark:border dark:border-white/10">
          <h2 className="text-3xl font-serif italic text-stone-900 dark:text-stone-100 mb-3">{t('landing.freeToUse')}</h2>
          <p className="text-stone-500 dark:text-stone-400 mb-6 max-w-xl mx-auto">
            {t('landing.freeToUseDesc')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <div className="text-2xl font-bold text-emerald-700">5</div>
              <div className="text-xs text-emerald-600">{t('landing.aiQuestionsPerDay')}</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4">
              <div className="text-2xl font-bold text-blue-700">2</div>
              <div className="text-xs text-blue-600">{t('landing.imageAnalysesPerDay')}</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950/40 rounded-2xl p-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">1</div>
              <div className="text-xs text-purple-600 dark:text-purple-400">{t('landing.premiumTtsPerDay')}</div>
            </div>
          </div>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {t('landing.likeTheApp')}
          </p>
        </section>

        {/* Final CTA */}
        <section className="bg-emerald-600 rounded-[2rem] p-8 md:p-14 text-center text-white shadow-[0_26px_65px_-32px_rgba(5,150,105,0.65)]">
          <h2 className="text-3xl md:text-4xl font-serif italic mb-4">{t('landing.readyToHelp')}</h2>
          <p className="text-emerald-100 mb-8 max-w-xl mx-auto text-lg">
            {t('landing.readyToHelpDesc')}
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-emerald-700 px-8 py-3 rounded-2xl font-medium shadow-lg hover:bg-emerald-50 transition-all active:scale-[0.98]"
          >
            {t('landing.getStartedFree')}
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center text-stone-400 dark:text-stone-500 text-sm pt-4 pb-8 space-y-2">
          <p>{t('landing.footerTagline')}</p>
          <p>{t('landing.footerSeo')}</p>
          <div className="flex items-center justify-center gap-4">
            {onShowPrivacy && (
              <button onClick={onShowPrivacy} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{t('auth.privacyPolicy')}</button>
            )}
            {onShowTerms && (
              <button onClick={onShowTerms} className="underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">{t('auth.termsOfService')}</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
