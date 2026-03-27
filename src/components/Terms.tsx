import { FileText, ArrowLeft, AlertTriangle, RefreshCw, Shield, Wrench, Scale } from 'lucide-react';

interface TermsProps {
  onBack: () => void;
}

export default function Terms({ onBack }: TermsProps) {
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
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif italic dark:text-stone-100">Användarvillkor</h1>
              <p className="text-xs text-stone-400 dark:text-stone-500 uppercase tracking-widest">Senast uppdaterad: mars 2026</p>
            </div>
          </div>

          <div className="prose prose-stone dark:prose-invert prose-sm max-w-none space-y-8">
            <p className="text-stone-600 dark:text-stone-300 leading-relaxed">
              Genom att använda Föräldrahjälpen ("tjänsten") godkänner du dessa användarvillkor.
              Läs igenom dem noggrant innan du skapar ett konto.
            </p>

            <Section icon={<FileText size={18} />} title="Om tjänsten">
              <p>
                Föräldrahjälpen är en AI-driven läxhjälpstjänst riktad till föräldrar med barn i svensk grundskola.
                Tjänsten tillhandahåller pedagogiska förklaringar, studieplanering och resursbibliotek med hjälp av
                artificiell intelligens (Google Gemini).
              </p>
              <p>
                Tjänsten är avsedd som <strong>stöd för föräldrar</strong> — inte som ersättning för lärare
                eller skolundervisning. AI-genererade svar kan innehålla fel och bör alltid granskas kritiskt.
              </p>
            </Section>

            <Section icon={<RefreshCw size={18} />} title="Ändringar och servicefönster">
              <p>
                Vi förbehåller oss rätten att <strong>när som helst uppdatera, ändra eller tillfälligt stänga ner</strong> tjänsten
                helt eller delvis, utan föregående meddelande. Detta inkluderar men begränsas inte till:
              </p>
              <ul className="space-y-2">
                <li>Planerade och oplanerade <strong>servicefönster</strong> för underhåll och uppgraderingar.</li>
                <li>Ändringar i funktionalitet, gränssnitt eller AI-modeller.</li>
                <li>Justeringar av användningsgränser (antal frågor, bildanalyser etc.).</li>
                <li>Uppdateringar av dessa villkor och integritetspolicyn.</li>
              </ul>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4 flex gap-3">
                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Det kan förekomma <strong>servicefönster</strong> där tjänsten tillfälligt är otillgänglig.
                  Vi strävar efter att minimera störningar men kan inte garantera 100% tillgänglighet.
                </p>
              </div>
            </Section>

            <Section icon={<Shield size={18} />} title="Användning av tjänsten">
              <p>Du förbinder dig att:</p>
              <ul className="space-y-2">
                <li>Använda tjänsten i enlighet med dess syfte — pedagogiskt stöd för föräldrar.</li>
                <li>Inte använda tjänsten för att generera olämpligt, stötande eller olagligt innehåll.</li>
                <li>Inte försöka kringgå tekniska begränsningar eller användningsgränser.</li>
                <li>Inte dela ditt konto med obehöriga.</li>
                <li>Ansvara för allt innehåll du laddar upp (bilder, texter).</li>
              </ul>
            </Section>

            <Section icon={<AlertTriangle size={18} />} title="Ansvarsbegränsning">
              <p>
                Föräldrahjälpen tillhandahålls <strong>"i befintligt skick"</strong> utan några garantier.
              </p>
              <ul className="space-y-2">
                <li>AI-genererade svar kan innehålla <strong>felaktigheter</strong>. Verifiera alltid viktig information.</li>
                <li>Vi ansvarar inte för beslut som fattas baserat på tjänstens svar.</li>
                <li>Vi garanterar inte att tjänsten är fri från avbrott, fel eller säkerhetsbrister.</li>
                <li>Vårt ansvar är begränsat till det belopp du eventuellt betalat för tjänsten.</li>
              </ul>
            </Section>

            <Section icon={<Scale size={18} />} title="Immateriella rättigheter">
              <ul className="space-y-2">
                <li>Tjänstens design, kod och varumärke tillhör Föräldrahjälpen.</li>
                <li>Innehåll du skapar (meddelanden, uppgifter, bilder) förblir ditt.</li>
                <li>AI-genererat innehåll (förklaringar, illustrationer) får användas fritt för personligt bruk.</li>
              </ul>
            </Section>

            <Section icon={<Wrench size={18} />} title="Konto och uppsägning">
              <ul className="space-y-2">
                <li>Du kan när som helst begära radering av ditt konto via kontaktformuläret eller e-post.</li>
                <li>Vi förbehåller oss rätten att stänga av konton som bryter mot dessa villkor.</li>
                <li>Vid uppsägning raderas din data enligt vår integritetspolicy.</li>
              </ul>
            </Section>

            <section>
              <h2 className="text-lg font-medium dark:text-stone-100 mb-2">Ändringar av villkoren</h2>
              <p className="text-stone-600 dark:text-stone-300">
                Vi kan uppdatera dessa villkor. Vid väsentliga ändringar informerar vi dig via appen.
                Fortsatt användning efter ändringar innebär att du godkänner de uppdaterade villkoren.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium dark:text-stone-100 mb-2">Kontakt</h2>
              <p className="text-stone-600 dark:text-stone-300">
                Har du frågor om dessa villkor? Kontakta oss på <strong>marcus.mpai@gmail.com</strong> eller
                via kontaktformuläret i appen.
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
