import React, { useState } from 'react';
import { BookOpen, MessageSquare, Calendar, Sparkles, ShieldCheck, Zap, ChevronDown, Camera, Users, Library, GraduationCap, CheckCircle, HelpCircle } from 'lucide-react';

function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 md:p-6 text-left hover:bg-stone-50 transition-colors"
      >
        <h3 className="text-lg font-medium text-stone-900 pr-4">{title}</h3>
        <ChevronDown size={20} className={`text-stone-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 md:px-6 pb-5 md:pb-6 pt-0 text-sm text-stone-600 leading-relaxed space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Info() {
  const features = [
    {
      icon: <MessageSquare className="text-emerald-600" />,
      title: "AI-driven läxhjälp",
      description: "Ställ frågor om alla skolämnen och få pedagogiska svar anpassade efter barnets årskurs. AI:n förklarar steg för steg och kopplar till läroplanen."
    },
    {
      icon: <Camera className="text-emerald-600" />,
      title: "Fota läxan",
      description: "Ta en bild på läxan med mobilen. AI:n analyserar texten och förklarar uppgiften, oavsett om det är matematik, svenska eller NO."
    },
    {
      icon: <Calendar className="text-emerald-600" />,
      title: "Läxplanering & kalender",
      description: "Planera veckans läxor med inlämningsdagar och arbetsdagar. Se allt i kalendervy och håll koll på deadlines."
    },
    {
      icon: <Sparkles className="text-emerald-600" />,
      title: "AI-illustrationer",
      description: "AI:n skapar pedagogiska bilder som gör förklaringar visuella. Perfekt för barn som lär sig bäst med bilder."
    },
    {
      icon: <Users className="text-emerald-600" />,
      title: "Dela med förälder",
      description: "Dela kalender och planering med en annan förälder. Perfekt för separerade föräldrar eller när båda vill ha koll."
    },
    {
      icon: <ShieldCheck className="text-emerald-600" />,
      title: "Trygg och säker",
      description: "All data sparas säkert i molnet. AI:n är instruerad att vara pedagogisk, stöttande och aldrig ge färdiga svar till elever."
    }
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 bg-[#F5F5F0]">
      <div className="max-w-3xl mx-auto space-y-10 py-6">
        {/* Header */}
        <header className="text-center space-y-4">
          <div className="inline-flex p-3 bg-emerald-100 rounded-2xl text-emerald-600 mb-2">
            <BookOpen size={32} />
          </div>
          <h1 className="text-4xl font-serif italic text-stone-900">Hur fungerar Föräldrahjälpen?</h1>
          <p className="text-lg text-stone-600 max-w-xl mx-auto">
            En komplett guide till alla funktioner i appen. Lär dig hur du får ut mest av AI-läxhjälpen, planeringen och alla verktyg.
          </p>
        </header>

        {/* Feature overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-black/5 hover:shadow-md transition-all">
              <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="text-base font-medium text-stone-900 mb-1">{f.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Quick start */}
        <section className="bg-emerald-600 rounded-[2rem] p-8 md:p-10 text-white overflow-hidden relative">
          <div className="relative z-10 space-y-5">
            <div className="flex items-center gap-2 text-emerald-200 text-sm font-bold uppercase tracking-widest">
              <Zap size={16} />
              <span>Kom igång snabbt</span>
            </div>
            <h2 className="text-2xl font-serif italic">Tre steg till läxhjälp</h2>
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">1</div>
                <p>Lägg till ditt barn i menyn och ange namn och årskurs. Du kan lägga till flera barn.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">2</div>
                <p>Börja chatta med AI-assistenten. Skriv en fråga som "Förklara bråktal för åk 5" eller fota en läxa.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-sm">3</div>
                <p>Använd planeringen för att schemalägga veckans läxor med inlämningsdagar och arbetsdagar.</p>
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        </section>

        {/* Detailed collapsible sections */}
        <div>
          <h2 className="text-2xl font-serif italic text-stone-900 mb-5 text-center">Detaljerad guide till alla funktioner</h2>
          <div className="space-y-3">

            <CollapsibleSection title="AI-assistenten — hur den förklarar läxor">
              <p>
                Föräldrahjälpens AI-assistent bygger på Google Gemini, en av världens mest avancerade AI-modeller. Den är specialtränad för att ge pedagogiska förklaringar anpassade till den svenska grundskolan och läroplanen Lgr22.
              </p>
              <p>
                <strong>Så använder du AI-assistenten:</strong> Skriv din fråga i chattfältet precis som du skulle fråga en lärare. Du kan vara specifik ("Hur löser man ekvationen 3x + 7 = 22?") eller mer allmän ("Förklara fotosyntesen enkelt"). AI:n anpassar svaret efter det barn du har valt och barnets årskurs.
              </p>
              <p>
                <strong>Koppling till Lgr22:</strong> Varje svar avslutas med en koppling till den svenska läroplanen. Du får veta vilket centralt innehåll som berörs, vilken förmåga som tränas och varför barnet lär sig just detta ämne. Det gör det lättare att förstå skolans mål och diskutera med läraren vid behov.
              </p>
              <p>
                <strong>Vilka ämnen stöds?</strong> Alla ämnen i den svenska grundskolan: matematik, svenska, engelska, biologi, fysik, kemi, teknik, historia, geografi, samhällskunskap, religion, moderna språk (spanska, tyska, franska), bild, musik, slöjd och idrott. AI:n kan hjälpa med allt från mattetal och grammatik till läsförståelse och NO-experiment.
              </p>
              <p>
                <strong>Pedagogiskt stöd, inte fusk:</strong> AI:n är designad för att hjälpa föräldern förstå uppgiften — inte ge barnet färdiga svar. Förklaringarna är steg-för-steg så att du som förälder kan vägleda ditt barn genom uppgiften. Det handlar om att bygga förståelse, inte om att klara läxan snabbt.
              </p>
              <p>
                <strong>Tips:</strong> Prova att fråga "Förklara som om jag är en förälder som inte minns hur man gör" — AI:n anpassar sig efter din formulering och ger enklare eller mer detaljerade förklaringar beroende på vad du behöver.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Fota läxan — bildanalys med AI">
              <p>
                Ibland är det enklare att ta en bild på läxan än att skriva av den. Med Föräldrahjälpens bildanalys kan du fotografera en läxa, ett mattetal, en text eller en uppgift direkt i appen. AI:n analyserar bilden och förklarar vad uppgiften handlar om och hur man kan lösa den.
              </p>
              <p>
                <strong>Så fungerar det:</strong> Klicka på kameraikonen i chatten och ta en bild med mobilen. AI:n använder avancerad bildigenkänning (Google Gemini med bildförmåga) för att läsa av text, siffror, diagram och figurer i bilden. Sedan får du en förklaring precis som om du hade skrivit frågan.
              </p>
              <p>
                <strong>Vad kan du fota?</strong> Mattetal och ekvationer, textstycken och läsförståelsefrågor, NO-diagram och kartor, engelska glosor och meningar, arbetsblad och stenciler från skolan, prov och gamla provfrågor. Bildanalys fungerar bäst med tydliga bilder tagna rakt framifrån med god belysning.
              </p>
              <p>
                <strong>Bildkomprimering:</strong> Appen komprimerar automatiskt bilder innan de skickas för att spara bandbredd och hålla nere kostnader. Du behöver inte tänka på bildstorlek — appen hanterar det automatiskt.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Läxplanering med veckokalender">
              <p>
                Föräldrahjälpens läxplanering hjälper dig hålla koll på alla ditt barns läxor, prov och inlämningar under veckan. Du ser allt i en tydlig kalendervy med markerade arbetsdagar och inlämningsdagar.
              </p>
              <p>
                <strong>Lägg till en uppgift:</strong> Klicka på en dag i kalendern och fyll i ämne, beskrivning och eventuell bild. Välj inlämningsdag (den dag uppgiften ska vara klar) och arbetsdagar (de dagar barnet ska jobba med uppgiften). Uppgiften visas på alla relevanta dagar i kalendern.
              </p>
              <p>
                <strong>Inlämningsdag och arbetsdagar:</strong> Systemet skiljer mellan inlämningsdagar (deadline) och arbetsdagar (planerade tillfällen att jobba med uppgiften). En inlämningsdag markeras med en röd etikett i kalendern, medan arbetsdagar visas med en blå etikett. På så sätt ser du enkelt vad som ska göras och när det ska vara klart.
              </p>
              <p>
                <strong>Statushantering:</strong> Varje uppgift kan markeras som klar, pågående eller ej påbörjad. Du kan också lägga till bilder på arbetsblad och stenciler direkt i uppgiften så att allt finns på ett ställe.
              </p>
              <p>
                <strong>AI-koppling:</strong> Från en uppgift i planeringen kan du gå direkt till AI-chatten och be om hjälp med just den uppgiften. AI:n ser då ämnet och beskrivningen och kan ge riktad hjälp.
              </p>
              <p>
                <strong>Perfekt för:</strong> Veckoläxor, glosförhör, matteprov, inlämningsuppgifter, bokrecensioner, SO-redovisningar och allt annat som barnet behöver göra hemma. Planeringen fungerar som en digital läxdagbok som hela familjen kan använda.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Dela kalender mellan föräldrar">
              <p>
                Med delningsfunktionen (tillgänglig i Pro-abonnemanget) kan du dela barnets läxkalender och all planering med en annan förälder. Det är särskilt värdefullt för separerade föräldrar eller för familjer där båda föräldrarna vill ha koll på barnets skolarbete.
              </p>
              <p>
                <strong>Hur du delar:</strong> Gå till barnhanteraren och klicka på delningsikonen. Ange den andra förälderns e-postadress. Den andre föräldern måste ha ett konto med samma e-postadress. När delningen är aktiv ser båda föräldrarna alla uppgifter, ändringar och bilder i realtid.
              </p>
              <p>
                <strong>Växelvis boende:</strong> Om ditt barn bor varannan vecka hos varje förälder är delningsfunktionen perfekt. Oavsett var barnet befinner sig har båda föräldrarna samma information om läxor, prov och deadlines. Ingen information faller mellan stolarna.
              </p>
              <p>
                <strong>Synkronisering i realtid:</strong> Alla ändringar synkas direkt via molnet (Firebase). Om en förälder lägger till en ny uppgift eller markerar en läxa som klar ser den andre föräldern ändringen omedelbart.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="AI-genererade illustrationer">
              <p>
                Ibland räcker det inte med text för att förstå ett koncept. Föräldrahjälpen kan skapa AI-genererade pedagogiska illustrationer som gör abstrakta begrepp visuella och lättare att förstå.
              </p>
              <p>
                <strong>Hur det fungerar:</strong> I chatten kan du be AI:n att skapa en bild som illustrerar det ni pratar om. AI:n använder bildgenerering (Gemini) för att skapa en unik bild anpassad efter ämnet. Bilderna är pedagogiska och skapade för att förtydliga förklaringar.
              </p>
              <p>
                <strong>Exempel:</strong> "Rita hur fotosyntesen fungerar", "Visa en bild av solsystemet", "Illustrera hur bråktal fungerar med tårtbitar", "Skapa en bild av en cell med alla delar markerade". Bilderna sparas i chatten och kan ses igen när som helst.
              </p>
              <p>
                <strong>Begränsningar:</strong> Gratisanvändare kan generera 1 bild per dag, Plus-användare får 2 per dag och Pro-användare 5 per dag. Bildgenereringen är den mest kostnadskrävande funktionen, men resultaten kan verkligen hjälpa barn som lär sig visuellt.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Resursbiblioteket — spara bra förklaringar">
              <p>
                Resursbiblioteket (tillgängligt i Plus- och Pro-abonnemang) låter dig spara särskilt bra förklaringar från AI-chatten så att du enkelt kan hitta dem igen. Det fungerar som en personlig kunskapsbank för ditt barns skolämnen.
              </p>
              <p>
                <strong>Så sparar du:</strong> När AI:n ger en förklaring som du vill spara klickar du på spara-ikonen i chatmeddelandet. Förklaringen läggs till i biblioteket med ämne och datum. Du kan söka, filtrera och bläddra bland sparade förklaringar.
              </p>
              <p>
                <strong>Användningsområden:</strong> Spara förklaringar inför prov, bygg upp en samling med formler och metoder, återanvänd förklaringar när barnet behöver repetera, och skapa ett arkiv av de bästa pedagogiska svaren. Biblioteket sparar tid genom att du inte behöver fråga samma sak igen.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Facit-funktionen — verifiera svar">
              <p>
                Facit-funktionen (tillgänglig i Plus- och Pro-abonnemang) visar dig det korrekta svaret på en uppgift så att du som förälder kan verifiera att barnet har löst uppgiften rätt. Det är inte tänkt att ge barnet facit — utan att ge dig trygghet i att barnet har förstått.
              </p>
              <p>
                <strong>Varför facit?</strong> Många föräldrar känner sig osäkra på om de hjälper barnet rätt, särskilt i matematik och NO. Med facit-funktionen kan du kontrollera att svaret stämmer innan barnet lämnar in. Du kan också använda det för att hitta eventuella misstag och diskutera dem med barnet som en lärandemöjlighet.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Läroplanen Lgr22 — vad är det?">
              <p>
                Lgr22 är den senaste versionen av den svenska läroplanen för grundskolan. Den trädde i kraft 2022 och innehåller uppdaterade kursplaner med nytt centralt innehåll och reviderade kunskapskrav för alla ämnen från årskurs 1 till 9.
              </p>
              <p>
                <strong>Varför kopplar vi till Lgr22?</strong> Genom att koppla varje AI-svar till relevant centralt innehåll i Lgr22 får du som förälder en förståelse för varför barnet lär sig just detta. Du kan se vilken förmåga som tränas och vilka kunskapskrav som gäller. Det gör det lättare att ha meningsfulla samtal med barnets lärare och förstå hur skolan bedömer.
              </p>
              <p>
                <strong>Vad ingår i kopplingen?</strong> Varje svar innehåller: relevant centralt innehåll (vad läroplanen säger att barnet ska lära sig), vilken förmåga som tränas (analysförmåga, kommunikationsförmåga etc.), och en förenklad förklaring av varför detta ingår i läroplanen. Allt skrivet på ett sätt som alla föräldrar kan förstå.
              </p>
              <p>
                <strong>Anpassat per årskurs:</strong> AI:n anpassar både svårighetsgraden och läroplanskopplingen efter det barn du har valt. En förklaring för åk 2 ser helt annorlunda ut än en för åk 8, både vad gäller språk och djup.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Installera appen på mobil eller dator">
              <p>
                Föräldrahjälpen är en PWA (Progressive Web App), vilket betyder att du kan installera den direkt på din telefon eller dator utan att behöva ladda ner något från App Store eller Google Play. Appen fungerar på iPhone, Android, Windows, Mac och iPad.
              </p>
              <p>
                <strong>Installera på iPhone/iPad:</strong> Öppna appen i Safari. Tryck på delningsikonen (fyrkant med pil uppåt). Välj "Lägg till på hemskärmen". Appen visas nu som en vanlig app på din hemskärm.
              </p>
              <p>
                <strong>Installera på Android:</strong> Öppna appen i Chrome. Du får automatiskt en fråga om att installera. Alternativt: tryck på de tre prickarna och välj "Installera app" eller "Lägg till på hemskärmen".
              </p>
              <p>
                <strong>Installera på dator:</strong> Öppna appen i Chrome eller Edge. Klicka på installationsikonen i adressfältet (den lilla datorikonen). Appen öppnas som ett eget fönster utan webbläsarens knappar.
              </p>
              <p>
                <strong>Fördelar med att installera:</strong> Snabbare start, fullskärmsläge utan webbläsarens gränssnitt, och en ikon på hemskärmen som gör det enkelt att snabbt starta appen när det är dags för läxläsning.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Abonnemang och priser">
              <p>
                Föräldrahjälpen erbjuder tre abonnemangsnivåer: Gratis, Plus och Pro. Alla planer inkluderar tillgång till AI-assistenten, läxplaneringen och koppling till Lgr22. Skillnaden ligger i mängden frågor du kan ställa och vilka extrafunktioner du får.
              </p>
              <p>
                <strong>Gratis (0 kr):</strong> 3 AI-frågor per dag, 1 bildanalys per dag, 1 AI-illustration per dag, full tillgång till läxplaneringen och kalender. Perfekt för att testa appen och se om den passar din familj.
              </p>
              <p>
                <strong>Plus (29 kr/mån eller 249 kr/år):</strong> 15 AI-frågor per dag, 5 bildanalyser per dag, 2 AI-illustrationer per dag, tillgång till resursbiblioteket och facit-funktionen. Bäst för familjer som använder appen regelbundet.
              </p>
              <p>
                <strong>Pro (59 kr/mån eller 499 kr/år):</strong> Obegränsade AI-frågor och bildanalyser, 5 AI-illustrationer per dag, dela kalender med föräldrar, prioriterad svarstid. Bäst för familjer med flera barn eller separerade föräldrar som behöver delning.
              </p>
              <p>
                <strong>Spara med årsbetalning:</strong> Väljer du att betala årsvis sparar du cirka 28% jämfört med månadsbetalning.
              </p>
            </CollapsibleSection>

            <CollapsibleSection title="Vanliga frågor (FAQ)">
              <div className="space-y-5">
                <div>
                  <p className="font-medium text-stone-900 mb-1">Är detta fusk?</p>
                  <p>Nej. Föräldrahjälpen hjälper dig som förälder att förstå uppgiften så att du kan vägleda ditt barn. AI:n ger pedagogiska förklaringar, inte färdiga svar. Det handlar om att bygga förståelse tillsammans med barnet.</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 mb-1">Vilka årskurser stöds?</p>
                  <p>Alla årskurser i grundskolan, från åk 1 till åk 9. AI:n anpassar språket och förklaringarna efter den årskurs du har angett för ditt barn.</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 mb-1">Sparas mina chattar?</p>
                  <p>Ja, chattar sparas säkert per barn i molnet (Firebase) och är bara tillgängliga för dig och eventuellt en delad förälder. Du kan se tidigare konversationer och fortsätta där du slutade.</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 mb-1">Kan jag använda appen på flera enheter?</p>
                  <p>Ja, eftersom appen är webbaserad fungerar den på alla enheter med en modern webbläsare: mobil, surfplatta och dator. Allt synkas automatiskt.</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 mb-1">Hur exakt är AI:n?</p>
                  <p>AI:n bygger på Google Gemini och ger generellt sett mycket bra svar, men det är alltid en AI och kan göra misstag. Använd facit-funktionen för att dubbelkolla svar i matematik, och kontakta oss om du hittar felaktigheter.</p>
                </div>
                <div>
                  <p className="font-medium text-stone-900 mb-1">Kan jag avbryta mitt abonnemang?</p>
                  <p>Ja, du kan avbryta när som helst via abonnemangsportalen. Ditt abonnemang gäller till slutet av den betalda perioden och går sedan automatiskt ner till gratisplanen.</p>
                </div>
              </div>
            </CollapsibleSection>

          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-stone-400 text-sm pb-8 space-y-1">
          <p>Föräldrahjälpen — AI-driven läxhjälp kopplad till svenska läroplanen Lgr22</p>
          <p>Stöd i matematik, svenska, engelska, NO och SO för grundskolan åk 1-9</p>
        </footer>
      </div>
    </div>
  );
}
