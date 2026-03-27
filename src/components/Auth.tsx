import React, { useState, useEffect } from 'react';
import { BookOpen, Mail, Eye, EyeOff, ArrowLeft, MessageSquare, Camera, Calendar, Sparkles, Library, CheckCircle, ChevronLeft, ChevronRight, Shield, GraduationCap, Users, Star, FileText } from 'lucide-react';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '../firebase';

interface AuthProps {
  onShowPrivacy?: () => void;
  onShowTerms?: () => void;
}

type AuthView = 'main' | 'email-login' | 'email-signup' | 'reset-password';

// App screenshot slideshow
const slides = [
  {
    title: "AI-assistent",
    description: "Ställ frågor och få pedagogiska svar anpassade efter barnets årskurs.",
    image: "/screenshots/chat.png",
    color: "from-emerald-500 to-emerald-700",
  },
  {
    title: "Detaljerade förklaringar",
    description: "AI:n förklarar steg för steg med koppling till läroplanen Lgr22.",
    image: "/screenshots/explanation.png",
    color: "from-blue-500 to-blue-700",
  },
  {
    title: "Smart veckoplanering",
    description: "Planera läxor med kalender, deadlines och arbetsdagar.",
    image: "/screenshots/planner.png",
    color: "from-amber-500 to-amber-700",
  },
  {
    title: "AI-genererade illustrationer",
    description: "Pedagogiska bilder som gör det enklare att förstå svåra koncept.",
    image: "/screenshots/illustration.png",
    color: "from-purple-500 to-purple-700",
  },
];

function AppSlideshow() {
  const [current, setCurrent] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
      <div className="bg-white rounded-3xl shadow-lg border border-black/5 overflow-hidden">
        {/* Image area */}
        <div className="relative overflow-hidden bg-stone-100">
          <img
            src={slide.image}
            alt={slide.title}
            className={`w-full h-[280px] md:h-[380px] object-cover object-top transition-all duration-300 ${isTransitioning ? 'opacity-0 scale-[1.02]' : 'opacity-100 scale-100'}`}
          />
          {/* Gradient overlay at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
        </div>
        {/* Caption */}
        <div className={`px-6 pb-5 pt-2 transition-all duration-300 ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${slide.color}`} />
            <h3 className="text-lg font-serif italic text-stone-900">{slide.title}</h3>
          </div>
          <p className="text-sm text-stone-500 leading-relaxed">{slide.description}</p>
        </div>
      </div>
      {/* Navigation dots */}
      <div className="flex items-center justify-center gap-3 mt-5">
        <button onClick={() => goTo((current - 1 + slides.length) % slides.length)} className="p-1.5 rounded-full text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
          <ChevronLeft size={20} />
        </button>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-emerald-600 w-6' : 'bg-stone-300 hover:bg-stone-400 w-2'}`}
          />
        ))}
        <button onClick={() => goTo((current + 1) % slides.length)} className="p-1.5 rounded-full text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default function Auth({ onShowPrivacy, onShowTerms }: AuthProps) {
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
      <div className="min-h-screen bg-[#F5F5F0] flex items-start justify-center pt-[12vh] md:pt-[15vh] p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-black/5 relative overflow-hidden">
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
              <input type="email" placeholder="E-postadress" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700" />
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50">
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
      <div className="min-h-screen bg-[#F5F5F0] flex items-start justify-center pt-[12vh] md:pt-[15vh] p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-[32px] p-8 md:p-12 shadow-sm border border-black/5 relative overflow-hidden">
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
              <input type="text" placeholder="Namn (valfritt)" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700" />
            )}
            <input type="email" placeholder="E-postadress" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700" />
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} placeholder="Lösenord" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-stone-700 pr-12" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-600">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-emerald-700 transition-all active:scale-[0.98] disabled:opacity-50">
              {loading ? 'Vänta...' : isSignup ? 'Skapa konto' : 'Logga in'}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-stone-500">
            {isSignup ? (
              <p>Har du redan ett konto?{' '}<button onClick={() => goTo('email-login')} className="text-emerald-600 hover:underline font-medium">Logga in</button></p>
            ) : (
              <>
                <p>Inget konto?{' '}<button onClick={() => goTo('email-signup')} className="text-emerald-600 hover:underline font-medium">Skapa konto</button></p>
                <button onClick={() => goTo('reset-password')} className="mt-2 text-stone-400 hover:text-emerald-600 hover:underline text-xs">Glömt lösenord?</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main landing page view
  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans">
      {/* Hero section with login */}
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Left side: Marketing hero */}
        <div className="flex-1 lg:w-1/2 flex flex-col justify-center p-6 md:p-10 lg:p-14 xl:p-20">
          <div className="max-w-lg mx-auto w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <BookOpen size={22} />
              </div>
              <span className="text-lg font-serif italic text-stone-900">Föräldrahjälpen</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-serif italic text-stone-900 mb-4 leading-tight">
              AI-driven läxhjälp för svenska föräldrar
            </h1>
            <p className="text-lg text-stone-600 mb-6 leading-relaxed">
              Vill du förstå ditt barns läxor? Fota uppgiften eller ställ en fråga och få pedagogiska
              förklaringar kopplade till svenska läroplanen Lgr22.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                <CheckCircle size={14} /> Gratis att starta
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                <GraduationCap size={14} /> Kopplat till Lgr22
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-sm font-medium">
                <Shield size={14} /> Säkert och tryggt
              </span>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: <MessageSquare size={16} />, text: "AI-läxhjälp i alla ämnen" },
                { icon: <Camera size={16} />, text: "Fota läxan med mobilen" },
                { icon: <Calendar size={16} />, text: "Veckoplanering & kalender" },
                { icon: <Users size={16} />, text: "Dela med annan förälder" },
                { icon: <Sparkles size={16} />, text: "AI-genererade illustrationer" },
                { icon: <Library size={16} />, text: "Resursbibliotek" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                  <span className="text-emerald-600">{f.icon}</span>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right side: Login card */}
        <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 md:p-10 lg:p-14 xl:p-20 bg-white/50">
          <div className="w-full max-w-md bg-white rounded-[32px] p-10 shadow-lg border border-black/5 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-600" />

            <h2 className="text-2xl font-serif italic text-stone-900 mb-2 mt-2">Kom igång</h2>
            <p className="text-stone-500 mb-8 text-sm">
              Skapa ett gratis konto och börja hjälpa ditt barn med läxorna idag.
            </p>

            {errorBox}

            <div className="space-y-3">
              <button onClick={handleGoogleLogin} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-4 px-6 rounded-2xl font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Logga in med Google
              </button>
              <button onClick={() => goTo('email-login')} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-white border border-stone-200 py-4 px-6 rounded-2xl font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-300 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50">
                <Mail size={20} className="text-emerald-600" />
                Logga in med e-post
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-black/5 grid grid-cols-2 gap-4">
              <div className="text-left">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Pedagogiskt</p>
                <p className="text-xs text-stone-500">Stöd för föräldrar, inte fusk för elever.</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Svensk skola</p>
                <p className="text-xs text-stone-500">Anpassat efter svensk läroplan Lgr22.</p>
              </div>
            </div>
            {(onShowPrivacy || onShowTerms) && (
              <p className="mt-4 text-xs text-stone-400">
                Genom att logga in godkänner du våra{' '}
                {onShowTerms && <button onClick={onShowTerms} className="underline hover:text-emerald-600 transition-colors">användarvillkor</button>}
                {onShowTerms && onShowPrivacy && ' och '}
                {onShowPrivacy && <button onClick={onShowPrivacy} className="underline hover:text-emerald-600 transition-colors">integritetspolicy</button>}.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Below-the-fold marketing content */}
      <div className="max-w-5xl mx-auto px-6 pb-20 space-y-20">

        {/* App slideshow */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 text-center mb-8">Se hur appen fungerar</h2>
          <AppSlideshow />
        </section>

        {/* How it works */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 text-center mb-3">Så hjälper vi dig med läxorna</h2>
          <p className="text-center text-stone-500 mb-10 max-w-2xl mx-auto">
            Föräldrahjälpen gör det enkelt att stötta ditt barn i skolan, oavsett om du har glömt hur man löser ekvationer eller aldrig lärt dig om Lgr22.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Ställ en fråga eller fota läxan",
                desc: "Skriv frågan i chatten eller ta en bild med mobilen. AI:n förstår både text och bilder — från mattetal till uppsatser.",
                icon: <Camera size={24} className="text-emerald-600" />,
              },
              {
                step: "2",
                title: "Få en pedagogisk förklaring",
                desc: "AI:n förklarar steg för steg, anpassat efter barnets årskurs. Varje svar kopplas till det centrala innehållet i Lgr22.",
                icon: <MessageSquare size={24} className="text-emerald-600" />,
              },
              {
                step: "3",
                title: "Planera och följ upp",
                desc: "Lägg till läxor i veckokalendern med deadlines och arbetsdagar. Dela planeringen med en annan förälder.",
                icon: <Calendar size={24} className="text-emerald-600" />,
              },
            ].map((s, i) => (
              <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 text-center">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-sm font-bold text-emerald-600 mb-2">Steg {s.step}</div>
                <h3 className="text-lg font-medium text-stone-900 mb-2">{s.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Subjects supported */}
        <section className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-black/5">
          <h2 className="text-3xl font-serif italic text-stone-900 text-center mb-3">Alla ämnen i grundskolan</h2>
          <p className="text-center text-stone-500 mb-8 max-w-2xl mx-auto">
            Föräldrahjälpen stöder alla ämnen som ditt barn har i skolan, från matematik och svenska till NO och SO. AI:n anpassar förklaringarna efter årskurs 1-9.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { subject: "Matematik", examples: "Bråktal, ekvationer, geometri, procent" },
              { subject: "Svenska", examples: "Grammatik, stavning, läsförståelse, uppsats" },
              { subject: "Engelska", examples: "Glosor, grammatik, textförståelse" },
              { subject: "NO", examples: "Biologi, fysik, kemi, teknik" },
              { subject: "SO", examples: "Historia, geografi, samhällskunskap, religion" },
              { subject: "Moderna språk", examples: "Spanska, tyska, franska" },
              { subject: "Bild & Musik", examples: "Kreativa ämnen och teori" },
              { subject: "Idrott & Hälsa", examples: "Teori, kost och hälsa" },
            ].map((s, i) => (
              <div key={i} className="bg-stone-50 rounded-2xl p-4">
                <h3 className="font-medium text-stone-900 mb-1">{s.subject}</h3>
                <p className="text-xs text-stone-500">{s.examples}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why parents need help */}
        <section>
          <h2 className="text-3xl font-serif italic text-stone-900 text-center mb-3">Varför behöver föräldrar läxhjälp?</h2>
          <p className="text-center text-stone-500 mb-10 max-w-2xl mx-auto">
            Skolarbetet ser annorlunda ut idag jämfört med när du gick i skolan. Läroplanen har ändrats, metoderna är nya, och det kan vara svårt att hänga med.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "Ny läroplan sedan 2022",
                desc: "Lgr22 introducerade nya centrala innehåll och förmågor. Föräldrahjälpen kopplar varje förklaring till det aktuella kursinnehållet så att du som förälder vet att informationen stämmer med vad skolan lär ut.",
                icon: <GraduationCap size={20} className="text-emerald-600" />,
              },
              {
                title: "Nya metoder i matematik",
                desc: "Tallinjer, areamodeller, positionssystem — mattemetoderna har förändrats. Med Föräldrahjälpen kan du snabbt förstå hur barnet förväntas lösa uppgiften och förklara det på rätt sätt.",
                icon: <Star size={20} className="text-emerald-600" />,
              },
              {
                title: "Separerade föräldrar",
                desc: "Med delad kalender kan båda föräldrarna ha koll på läxor och deadlines, oavsett var barnet bor den veckan. Perfekt för växelvis boende.",
                icon: <Users size={20} className="text-emerald-600" />,
              },
              {
                title: "Alla har rätt att förstå",
                desc: "Oavsett om du har universitetskurser i matematik eller aldrig avslutade grundskolan — Föräldrahjälpen ger dig verktygen att stötta ditt barn pedagogiskt.",
                icon: <Shield size={20} className="text-emerald-600" />,
              },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">{item.icon}</div>
                  <h3 className="font-medium text-stone-900">{item.title}</h3>
                </div>
                <p className="text-sm text-stone-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Free to use + support */}
        <section className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-black/5 text-center">
          <h2 className="text-3xl font-serif italic text-stone-900 mb-3">Gratis att använda</h2>
          <p className="text-stone-500 mb-6 max-w-xl mx-auto">
            Läxhjälpen är helt gratis med begränsad daglig användning. Abonnemangsplaner med mer användning är under planering.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <div className="text-2xl font-bold text-emerald-700">5</div>
              <div className="text-xs text-emerald-600">AI-frågor/dag</div>
            </div>
            <div className="bg-blue-50 rounded-2xl p-4">
              <div className="text-2xl font-bold text-blue-700">2</div>
              <div className="text-xs text-blue-600">Bildanalyser/dag</div>
            </div>
            <div className="bg-purple-50 rounded-2xl p-4">
              <div className="text-2xl font-bold text-purple-700">2</div>
              <div className="text-xs text-purple-600">Illustrationer/dag</div>
            </div>
          </div>
          <p className="text-sm text-stone-500">
            Gillar du appen? Du kan stötta projektet via Swish inne i appen.
          </p>
        </section>

        {/* Final CTA */}
        <section className="bg-emerald-600 rounded-[2rem] p-8 md:p-14 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-serif italic mb-4">Redo att hjälpa ditt barn?</h2>
          <p className="text-emerald-100 mb-8 max-w-xl mx-auto text-lg">
            Skapa ett gratis konto och testa Föräldrahjälpen idag. Ingen betalning krävs.
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-emerald-700 px-8 py-3 rounded-2xl font-medium shadow-lg hover:bg-emerald-50 transition-all active:scale-[0.98]"
          >
            Kom igång gratis
          </button>
        </section>

        {/* Footer */}
        <footer className="text-center text-stone-400 text-sm pt-4 pb-8 space-y-2">
          <p>Föräldrahjälpen — AI-driven läxhjälp kopplad till svenska läroplanen Lgr22</p>
          <p>Hjälp med läxor i matematik, svenska, engelska, NO och SO för grundskolan åk 1-9</p>
          <div className="flex items-center justify-center gap-4">
            {onShowPrivacy && (
              <button onClick={onShowPrivacy} className="underline hover:text-emerald-600 transition-colors">Integritetspolicy</button>
            )}
            {onShowTerms && (
              <button onClick={onShowTerms} className="underline hover:text-emerald-600 transition-colors">Användarvillkor</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
