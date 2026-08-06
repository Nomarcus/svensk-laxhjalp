# App Store-inlämning — steg för steg

Den här guiden är uppdelad i vad som redan är klart i koden, och vad **du** måste
göra själv (Apple kräver ditt eget Apple-ID, betalkort och juridiska godkännanden
— det finns inget sätt att automatisera bort de stegen). Jag har försökt göra
varje steg så konkret som möjligt så du kan bocka av dem i ordning.

Du har ingen Mac. Lösningen är [Codemagic](https://codemagic.io) — en
molntjänst som bygger, signerar och laddar upp iOS-appen åt dig. Du klickar
runt i deras webbgränssnitt och Apples egna sidor; själva Mac-datorn finns i
deras moln och du behöver aldrig röra den direkt.

---

## ✅ Redan klart i koden

- `ios/`-projektet finns (Capacitor), med rätt app-namn ("Föräldrahjälpen"),
  bundle-id (`se.foraldrahjalpen.app`), ikon (1024×1024, ingen transparens —
  Apples krav) och startskärm.
- Kamera-/bildbibliotek-behörighetstexter i `ios/App/App/Info.plist`.
- `codemagic.yaml` i repo-roten — färdig byggkonfiguration (se nedan för vad
  du behöver fylla i från din sida).
- Självbetjänad kontoradering, publik integritetspolicy-URL, m.m. — de
  App Store-kraven är redan lösta (se tidigare PR:ar).
- Stripe är borttaget helt — appen är gratis tills ett riktigt Apple-köp
  (StoreKit) byggs, så det finns inget betalflöde som Apple kan underkänna.

## ⏳ Kvarstår (i ordning)

### 1. Registrera Apple Developer-konto (du)

1. Gå till **developer.apple.com/programs** → "Enroll".
2. Logga in med (eller skapa) ett Apple-ID.
3. Välj **Individual** (privatperson) om du inte har ett registrerat företag
   — det går snabbast (ingen D-U-N-S-verifiering krävs). Välj **Organization**
   bara om du specifikt vill att appen ska stå i ett företags namn i butiken.
4. Betala 99 USD/år.
5. Verifieringen tar normalt några timmar upp till ett par dygn.

**Resultat du behöver spara:** ditt **Team ID** (10 tecken, visas under
Membership på developer.apple.com när kontot är aktivt).

### 2. Skapa app-posten i App Store Connect (du)

1. Gå till **appstoreconnect.apple.com** → **Apps** → **+** → **New App**.
2. Platform: iOS. Namn: **Föräldrahjälpen** (eller annat om det namnet är
   upptaget — kolla ledigt namn i förväg om du vill).
3. Primärt språk: Svenska.
4. Bundle ID: välj **se.foraldrahjalpen.app** — om den inte redan finns i
   listan, gå först till developer.apple.com → **Certificates, Identifiers &
   Profiles** → **Identifiers** → **+** och registrera den (App ID, Explicit,
   `se.foraldrahjalpen.app`, inga extra capabilities behövs — appen använder
   varken push-notiser eller andra särskilda iOS-funktioner).
5. SKU: valfritt internt värde, t.ex. `foraldrahjalpen-ios-1`.

### 3. Skapa en App Store Connect API-nyckel (du)

Den här nyckeln är det Codemagic använder för att bygga, signera och ladda
upp automatiskt — utan den måste allt göras manuellt i Xcode (som du inte har).

1. App Store Connect → **Users and Access** → fliken **Integrations** →
   **App Store Connect API**.
2. **Generate API Key**. Namn: valfritt (t.ex. "Codemagic"). Roll: **Admin**
   (eller lägst **App Manager** — Admin är enklast för att slippa problem).
3. Ladda ner `.p8`-filen **direkt** — den går bara att ladda ner en gång.
4. Notera **Key ID** och **Issuer ID** (visas på samma sida).

**Spara säkert:** `.p8`-filen + Key ID + Issuer ID. Om du tappar bort
`.p8`-filen måste du generera en ny nyckel.

### 4. Koppla ihop Codemagic (du)

1. Skapa konto på **codemagic.io** (kan logga in med GitHub).
2. **Add application** → koppla ditt GitHub-konto → välj repot
   `Nomarcus/svensk-laxhjalp`.
3. När Codemagic frågar hur appen ska byggas: välj **"Use existing
   codemagic.yaml"** (filen finns redan i repot från mig).
4. Gå till **Teams → din team → Integrations → Apple Developer Portal** →
   lägg till en ny integration:
   - Klistra in Key ID, Issuer ID, och ladda upp `.p8`-filen från steg 3.
   - Namnge integrationen **exakt** `foraldrahjalpen_appstore` (matchar
     `codemagic.yaml` — annars måste du ändra namnet i filen istället och be
     mig committa ändringen).
5. Öppna `codemagic.yaml` i Codemagics egen editor (eller be mig ändra den) och
   byt ut `your-email@example.com` mot din riktiga mejladress, så du får
   bygg-notiser.

### 5. Kör det första bygget (du, eller be mig trigga det)

`codemagic.yaml` är konfigurerad att bygga när du push:ar en **git-tagg** som
matchar `ios-*`, t.ex.:

```bash
git tag ios-1.0.0
git push origin ios-1.0.0
```

Säg gärna till mig när du är här — jag kan skapa och pusha taggen åt dig
direkt i repot, då slipper du terminalen helt.

Bygget tar ~15–25 minuter första gången. Om något går fel (fel bundle-id,
saknad profil, etc.) visar Codemagic tydliga loggar — klistra in felet till
mig så hjälper jag dig tolka det.

### 6. Testa via TestFlight (du)

1. När bygget lyckas laddas det automatiskt upp till **TestFlight**
   (App Store Connect → din app → TestFlight-fliken) — `submit_to_testflight:
   true` i konfigurationen sköter det.
2. Ladda ner **TestFlight**-appen på en iPhone (din egen eller låna någons).
3. Lägg till dig själv som intern testare i App Store Connect → TestFlight →
   Internal Testing, så kan du installera och testa den riktiga appen.
4. Verifiera särskilt: gäst-inloggning, kamera/bilduppladdning (de nya
   behörighetstexterna), kontoradering, mobilheadern på chattfliken (den
   ändring vi gjorde nyss).

### 7. Fyll i butikslistan (du, jag har förberett texten)

App Store Connect → din app → **App Store**-fliken. Se
[APP_STORE_LISTING.md](./APP_STORE_LISTING.md) för färdig text att klistra in
(namn, beskrivning, nyckelord, sekretessdeklaration, m.m.).

Skärmdumpar måste tas från den riktiga appen (jag kan inte generera dem —
sandlådan här kan inte logga in mot er riktiga Firebase). Ta dem enklast
direkt i TestFlight-appen på en iPhone (eller iPhone-simulator om du får
tillgång till en Mac-skärm via Codemagic/en vän), i rätt storlek för de
skärmstorlekar Apple kräver (visas i App Store Connect när du laddar upp).

### 8. Åldersgräns, sekretessdeklaration, pris (du)

- **Age Rating**: appen är till för föräldrar, inte barn — svara ärligt på
  frågeformuläret (inget vuxet innehåll, inga sociala funktioner mellan
  främlingar, etc.) — hamnar troligen på 4+.
- **Pricing**: Gratis.
- **App Privacy**: se `APP_STORE_LISTING.md` för färdig mappning av vilka
  datatyper som samlas in (namn/e-post, barnets förnamn+årskurs, chattdata)
  baserat på den faktiska integritetspolicyn i appen.

### 9. Skicka in för granskning (du)

App Store Connect → **Submit for Review**. Granskningstiden är normalt
24–48 timmar. Om Apple avslår: klistra in avslagstexten till mig, så hjälper
jag dig tolka vad som behöver ändras och fixar det i koden om det är
tekniskt.

---

## Om något krånglar

- **Codemagic-bygget failar på signering**: oftast saknas App ID:t i Apple
  Developer Portal (steg 2) eller integrationen har fel behörighet (steg 3).
- **"No profiles found"**: kör om bygget efter att App ID:t finns — Codemagic
  skapar certifikat/profiler automatiskt första gången annars.
- **Vill hellre ha ett riktigt fjärrskrivbord istället för Codemagics
  YAML-baserade bygge**: MacInCloud eller liknande fungerar också — då kör du
  Xcode "på riktigt" i en fjärrsession, mer manuellt men känns bekantare. Säg
  till så skriver jag om instruktionerna för den vägen istället.

Säg till i chatten när du klarat ett steg (eller fastnat) så fortsätter jag
härifrån.
