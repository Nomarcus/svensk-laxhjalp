import { Shield, ArrowLeft, Database, Brain, Lock, UserCheck, Cookie, Server, Trash2, Mail } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="min-h-screen bg-[#F5F5F0] dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Tillbaka</span>
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-12 shadow-sm border border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif italic dark:text-stone-100">Integritetspolicy & GDPR</h1>
              <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest">Senast uppdaterad: mars 2026</p>
            </div>
          </div>

          <div className="prose prose-stone dark:prose-invert prose-sm max-w-none space-y-8">
            {/* Intro */}
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Föräldrahjälpen ("vi", "oss") värnar om din integritet. Denna policy beskriver hur vi samlar in,
              använder och skyddar dina personuppgifter i enlighet med EU:s dataskyddsförordning (GDPR).
            </p>

            {/* Personuppgiftsansvarig */}
            <Section
              icon={<UserCheck size={18} />}
              title="Personuppgiftsansvarig"
            >
              <p>Personuppgiftsansvarig för behandlingen av dina uppgifter är:</p>
              <div className="bg-stone-50 dark:bg-slate-800 rounded-xl p-4 text-sm">
                <p className="font-medium dark:text-stone-200">Föräldrahjälpen</p>
                <p className="text-stone-500 dark:text-stone-400">E-post: marcus.mpai@gmail.com</p>
              </div>
            </Section>

            {/* Vilka data samlar vi in */}
            <Section
              icon={<Database size={18} />}
              title="Vilka personuppgifter samlar vi in?"
            >
              <p>Vi samlar in följande uppgifter:</p>
              <ul className="space-y-2">
                <li><strong>Kontouppgifter:</strong> Namn, e-postadress och profilbild från din Google-inloggning.</li>
                <li><strong>Barnprofiler:</strong> De namn du anger för dina barn (inga personnummer eller känsliga uppgifter krävs).</li>
                <li><strong>Chattmeddelanden:</strong> Frågor och svar i AI-chatten, sparade i Firebase Firestore.</li>
                <li><strong>Uppgifter och planering:</strong> Läxuppgifter, schemalagda uppgifter och studieplaner du skapar.</li>
                <li><strong>Biblioteksinnehåll:</strong> Sparade förklaringar och AI-genererade bilder.</li>
                <li><strong>Uppladdade bilder:</strong> Bilder du laddar upp för analys (t.ex. foton på läxor).</li>
              </ul>
            </Section>

            {/* Rättslig grund */}
            <Section
              icon={<Lock size={18} />}
              title="Rättslig grund för behandling"
            >
              <p>Vi behandlar dina personuppgifter baserat på:</p>
              <ul className="space-y-2">
                <li><strong>Avtal (Art. 6.1b GDPR):</strong> Behandlingen är nödvändig för att tillhandahålla tjänsten du använder.</li>
                <li><strong>Samtycke (Art. 6.1a GDPR):</strong> Du ger aktivt samtycke genom att logga in och använda tjänsten.</li>
                <li><strong>Berättigat intresse (Art. 6.1f GDPR):</strong> För att förbättra och felsöka tjänsten.</li>
              </ul>
            </Section>

            {/* AI-behandling */}
            <Section
              icon={<Brain size={18} />}
              title="AI-behandling av data"
            >
              <p>
                Dina chattmeddelanden skickas till <strong>Google Gemini AI</strong> för att generera svar och förklaringar.
              </p>
              <ul className="space-y-2">
                <li>AI-tjänsten lagrar <strong>inte</strong> dina meddelanden permanent.</li>
                <li>Meddelanden används <strong>inte</strong> för att träna AI-modeller.</li>
                <li>Bilder du laddar upp analyseras av AI:n och lagras i Firebase — inte av Google Gemini.</li>
                <li>AI-genererade illustrationer skapas via DALL·E/bildgenererings-API och lagras i din profil.</li>
              </ul>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
                Google Gemini AI hanteras enligt Googles Cloud-tjänstevillkor och databehandlingsavtal.
              </p>
            </Section>

            {/* Lagring och säkerhet */}
            <Section
              icon={<Server size={18} />}
              title="Lagring och säkerhet"
            >
              <ul className="space-y-2">
                <li><strong>Lagringsplats:</strong> Dina data lagras i Google Firebase (EU/US) med kryptering i vila och under överföring.</li>
                <li><strong>Autentisering:</strong> Vi använder Firebase Authentication med Google OAuth 2.0.</li>
                <li><strong>Åtkomstkontroll:</strong> Firebase Security Rules säkerställer att bara du och eventuellt delade användare kommer åt din data.</li>
                <li><strong>Hosting:</strong> Appen hostas på Vercel med HTTPS-kryptering.</li>
              </ul>
              <p className="text-sm text-stone-600 dark:text-stone-300 mt-3">
                <strong>Tredjelandsöverföring:</strong> Data kan överföras till USA via Google Firebase och Vercel.
                Båda har stöd för EU-standardavtalsklausuler (SCCs) och är certifierade under EU-US Data Privacy Framework.
              </p>
            </Section>

            {/* Delning */}
            <Section
              icon={<Lock size={18} />}
              title="Delning av data"
            >
              <p>Vi delar dina data med följande underbiträden — och inga andra tredje parter:</p>
              <ul className="space-y-2">
                <li><strong>Google Firebase</strong> — Lagring, autentisering och realtidsdatabas.</li>
                <li><strong>Google Gemini AI</strong> — AI-genererade svar på dina frågor.</li>
                <li><strong>Vercel</strong> — Hosting av webbapplikationen och serverless-funktioner.</li>
                <li><strong>Resend</strong> — E-postleverans (kontaktformulär). Enbart e-postadress och meddelande.</li>
              </ul>
              <p>Vi säljer <strong>aldrig</strong> dina personuppgifter och använder <strong>inga</strong> reklamnätverk.</p>
            </Section>

            {/* Cookies */}
            <Section
              icon={<Cookie size={18} />}
              title="Cookies och lokal lagring"
            >
              <ul className="space-y-2">
                <li><strong>Nödvändiga cookies:</strong> Firebase Authentication-cookies för att hålla dig inloggad.</li>
                <li><strong>Lokal lagring:</strong> Inställningar som mörkt läge och PWA-installationsstatus sparas lokalt i din webbläsare.</li>
                <li><strong>Inga spårningscookies:</strong> Vi använder varken Google Analytics, Facebook Pixel eller andra spårningsverktyg.</li>
                <li><strong>Inga tredjepartscookies:</strong> Inga annonsnätverk eller externa analysverktyg.</li>
              </ul>
            </Section>

            {/* GDPR-rättigheter */}
            <Section
              icon={<UserCheck size={18} />}
              title="Dina rättigheter enligt GDPR"
            >
              <p>Som registrerad har du följande rättigheter:</p>
              <div className="space-y-3">
                {[
                  { right: 'Rätt till tillgång (Art. 15)', desc: 'Du kan begära en kopia av alla personuppgifter vi har om dig.' },
                  { right: 'Rätt till rättelse (Art. 16)', desc: 'Du kan begära att felaktiga uppgifter korrigeras.' },
                  { right: 'Rätt till radering (Art. 17)', desc: 'Du kan begära att vi raderar alla dina personuppgifter ("rätten att bli glömd").' },
                  { right: 'Rätt till begränsning (Art. 18)', desc: 'Du kan begära att vi begränsar behandlingen av dina uppgifter.' },
                  { right: 'Rätt till dataportabilitet (Art. 20)', desc: 'Du kan begära att få dina uppgifter i ett maskinläsbart format.' },
                  { right: 'Rätt att invända (Art. 21)', desc: 'Du kan invända mot behandling baserad på berättigat intresse.' },
                  { right: 'Rätt att återkalla samtycke', desc: 'Du kan när som helst återkalla ditt samtycke genom att radera ditt konto.' },
                ].map((item, i) => (
                  <div key={i} className="bg-stone-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{item.right}</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
                För att utöva dina rättigheter, kontakta oss på <strong>marcus.mpai@gmail.com</strong>.
                Vi svarar inom 30 dagar.
              </p>
            </Section>

            {/* Radering */}
            <Section
              icon={<Trash2 size={18} />}
              title="Radering av konto och data"
            >
              <p>Du kan när som helst begära att vi raderar ditt konto och all tillhörande data genom att:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Kontakta oss via e-post eller kontaktformuläret i appen.</li>
                <li>Vi raderar alla dina data från Firebase inom 30 dagar.</li>
                <li>Du får en bekräftelse när raderingen är genomförd.</li>
              </ol>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
                Observera att radering av ditt konto är permanent och kan inte ångras.
              </p>
            </Section>

            {/* Barn */}
            <Section
              icon={<Shield size={18} />}
              title="Barns integritet"
            >
              <p>
                Föräldrahjälpen är utformad för att användas av <strong>föräldrar</strong>, inte direkt av barn.
                Föräldern är ansvarig för att lägga till och hantera barnprofiler.
              </p>
              <ul className="space-y-2">
                <li>Vi samlar <strong>inte</strong> in personnummer, skolor eller andra känsliga uppgifter om barn.</li>
                <li>Barnprofiler innehåller enbart förnamn och årskurs.</li>
                <li>Chattkonversationer sparas under förälderns konto och kontrolleras av föräldern.</li>
              </ul>
            </Section>

            {/* Tillsynsmyndighet */}
            <Section
              icon={<Mail size={18} />}
              title="Klagomål och tillsynsmyndighet"
            >
              <p>
                Om du anser att vi behandlar dina personuppgifter felaktigt har du rätt att lämna klagomål
                till Integritetsskyddsmyndigheten (IMY):
              </p>
              <div className="bg-stone-50 dark:bg-slate-800 rounded-xl p-4 text-sm">
                <p className="font-medium dark:text-stone-200">Integritetsskyddsmyndigheten (IMY)</p>
                <p className="text-stone-500 dark:text-stone-400">Box 8114, 104 20 Stockholm</p>
                <p className="text-stone-500 dark:text-stone-400">imy@imy.se</p>
                <p className="text-stone-500 dark:text-stone-400">www.imy.se</p>
              </div>
            </Section>

            {/* Ändringar */}
            <section>
              <h2 className="text-lg font-medium dark:text-stone-100 mb-2">Ändringar av denna policy</h2>
              <p className="text-stone-600 dark:text-stone-300">
                Vi kan uppdatera denna integritetspolicy. Vid väsentliga ändringar informerar vi dig via appen.
                Senaste version finns alltid tillgänglig i appen.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
        <h2 className="text-lg font-medium dark:text-stone-100">{title}</h2>
      </div>
      <div className="text-stone-600 dark:text-stone-300 space-y-3 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}
