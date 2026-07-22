# Säkerhets- och kostnadsanalys

Datum: 2026-07-22. Detta är en statisk kodgranskning, inte ett penetrationstest av produktion.

## Sammanfattning

Applikationen har flera bra grundskydd: Firebase ID-token verifieras på AI- och
betalningsanrop, Firestore-regler avgränsar data per användare, Stripe-webhooks
signaturkontrolleras, indata för chattbilder begränsas och webb/API skickar flera
säkerhetsrubriker.

De viktigaste riskerna som hittades var att de två backend-varianterna (Express på
Cloud Run och serverless-funktionerna i `api/`) inte tillämpade samma
abonnemangsregler, att kvoträkning inte var atomisk och att rate limiting endast
finns i minnet på varje instans. De två första punkterna har åtgärdats i kod;
delad rate limiting är fortsatt rekommenderad.

## Fynd och rekommenderad prioritet

### Åtgärdad: olika skydd i Cloud Run och Vercel

Express-flödet lägger `subscriptionMiddleware` framför AI-routes. De separata
funktionerna kontrollerar nu också dagskvot för chatt/bildanalys och betalstatus
för bildgenerering. Därmed kan en inloggad gratisanvändare inte välja Vercel-vägen
för att kringgå samma affärsregler när begränsningarna är aktiverade.

**Kvarstår:** välj helst en kanonisk backend och stäng oanvänd deployment. Lägg
integrationstest mot båda varianterna så att de inte glider isär igen.

### Åtgärdad: atomisk kvotreservation

Chatt och bildanalys reserverar nu användning i en Firestore-transaktion innan
AI-anropet. TTS använder samma atomiska reservation. Parallella anrop kan därför
inte läsa samma räknare och samtliga passera taket.

Misslyckade leverantörsanrop räknas avsiktligt. Detta fail-closed-beteende prioriterar
ett förutsägbart kostnadstak framför automatisk återbetalning av enstaka fel.

### Medel: rate limiting är lokalt och proxyberoende

Serverless-skyddets räknare finns i processminnet och delas inte mellan instanser.
Express-rate-limit använder också standardminnet. Horisontell skalning gör därför
gränsen ungefärlig. Klient-IP kommer dessutom från proxyheaders, vilket kräver att
plattformens proxy alltid skriver över dem.

I denna ändring normaliseras path så varierande query-parametrar inte kringgår
gränsen, lagret får en minnesgräns och serverless-svar får `no-store` samt
säkerhetsrubriker. För starkt kostnadsskydd bör lagret ersättas av en delad,
atomisk räknare per verifierad Firebase-UID.

### Medel: kontaktformulär och personuppgifter

Kontakt-endpointen är publik. Tidigare accepterade den obegränsade strängar,
loggade namn, e-post och hela meddelandet när e-postleverantören saknades och
svarade ändå med framgång. Det riskerade spam, loggkostnad och missvisande UI.

I denna ändring valideras typ, e-post och längd. Endpointen svarar 503 utan
konfigurerad leverantör och loggar inte kontaktuppgifter. Lägg gärna CAPTCHA eller
Firebase App Check framför formuläret om spam uppstår.

### Medel: innehåll med barnuppgifter skickas till externa AI-tjänster

Läxfoton och chatthistorik kan innehålla namn, skola eller annan information om
barn. Bilder begränsas i typ, antal och storlek, men det finns ingen automatisk
maskning av personuppgifter före AI-anropet.

**Åtgärd:** minimera skickad historik, informera tydligt före bilduppladdning,
definiera lagringstid och leverantörsregion, och överväg OCR-baserad maskning. Logga
inte promptar eller bilddata. Nuvarande usage-loggar innehåller UID; använd en
pseudonym eller kort retention om detaljerad användarspårning inte behövs.

### Låg/medel: CSP kan skärpas

Webbens CSP tillåter `'unsafe-inline'` för script och style. Det minskar skyddet
mot XSS. React-renderingen använder normalt säker text-rendering, men policyn bör
ändå göras striktare.

**Åtgärd:** ta bort `'unsafe-inline'` för script och använd hash/nonce där inline
kod verkligen krävs. Verifiera först Firebase/Google-inloggning och Stripe-flöden
i staging.

## Modell- och kostnadsbedömning

### Textchatt

Produktionsserverns default är redan `gemini-2.5-flash-lite`, vilket uttryckligen
är lite-varianten. Ett byte till en större Flash/Pro-modell för vanlig text är
därför sannolikt en kostnadsökning, inte en besparing. `.env.example` och båda
backend-varianterna har nu samma text-default.

**Rekommendation:** behåll en billig lite-modell för ren text. Kör ett fast svenskt
testset (matte, språk, Lgr22, enkel svenska) innan ett versionsbyte. Mät kostnad per
godkänt svar, inte bara pris per token. Sätt även ett tak för output tokens om SDK:n
och svarskvaliteten tillåter det; kortare svar är både produktkrav och besparing.

### Bildanalys

Bildfrågor hårdkodas till `gemini-2.5-flash` och kan inte styras med samma
`AI_TEXT_MODEL`. Det är en tydlig kandidat för A/B-test: prova den billigaste
vision-kompatibla lite-modell som leverantören för närvarande stöder och fall
tillbaka till Flash endast när OCR/analys misslyckas. Kontrollera först kvalitet på
svenska arbetsblad, handstil och flerdelade matteuppgifter.

### Bildgenerering

Bildmodellens default är nu konsekvent mellan `.env.example`, Express och Vercel.
Bildgenerering har samma premiumkontroll i båda backend-varianterna. Det största
sparsteget är fortfarande att begränsa generering, återanvända resultat och erbjuda
färdiga pedagogiska illustrationer; en billigare modell är sekundärt.

### Talsyntes

Koden föredrar Standard-röst och faller tillbaka till Neural. Webbläsarens lokala
TTS finns redan som gratis fallback. Behåll lokal TTS som standard för gratisnivån
och gör molnröst till ett aktivt premiumval. Det sparar mer än att byta språkmodell.

## Föreslagen ordning

1. Stäng eller säkra den backend som saknar entitlement-kontroll.
2. Gör kvotreservation atomisk per UID och lägg ett månatligt budgetlarm hos Google.
3. Konsolidera modellkonfiguration till ett ställe och logga modell + tokenmängd,
   utan prompt eller personuppgifter.
4. A/B-testa billig vision-lite för bildanalys.
5. Behåll Flash-Lite för text tills ett mätbart test visar bättre kostnad per korrekt svar.
6. Använd webbläsar-TTS och statiska/cachade bilder där det går.

## Avgränsningar

Paketdatabasens säkerhetskontroll och leverantörens aktuella modell/prissidor kunde
inte nås från granskningsmiljön (HTTP 403). Därför anges inga prisbelopp här.
Verifiera aktuella modell-ID:n, livscykel och priser i Googles officiella
dokumentation före driftsättning. Kör även `npm audit` i CI med fungerande åtkomst
till npm-registret.
