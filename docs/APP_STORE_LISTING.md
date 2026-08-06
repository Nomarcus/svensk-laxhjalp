# App Store-listing — färdig text att klistra in

Allt nedan är skrivet för App Store Connect → din app → **App Store**-fliken.
Teckengränserna är Apples faktiska gränser — texterna nedan ligger under dem.

## App-namn (max 30 tecken)

```
Föräldrahjälpen
```
(15 tecken — gott om marginal.)

## Undertitel (max 30 tecken)

```
AI-läxhjälp för föräldrar
```
(26 tecken.)

## Marknadsföringstext / Promotional Text (max 170 tecken, kan ändras när som helst utan ny granskning)

```
Fota läxan, få den förklarad enligt Lgr22 och planera veckan — AI-läxhjälp gjord för föräldrar, inte för eleven själv.
```

## Beskrivning (max 4000 tecken)

```
Föräldrahjälpen är en AI-läxhjälp gjord för dig som förälder — inte för att göra läxan åt barnet, utan för att ge dig verktygen att hjälpa på rätt sätt.

VARFÖR FÖRÄLDRAHJÄLPEN?
Läroplanen (Lgr22) har ändrats sedan du själv gick i skolan. Nya räknemetoder, nya begrepp, nytt sätt att arbeta. Föräldrahjälpen förklarar läxan på det sätt barnet faktiskt lär sig i skolan just nu — inte hur du lärde dig för 20 år sedan.

SÅ FUNKAR DET
• Fota läxan eller ställ en fråga i chatten
• Få en pedagogisk förklaring kopplad till Lgr22:s centrala innehåll
• Använd Coach-läge för att ställa frågor till barnet istället för att ge färdiga svar
• Enkel svenska-läge för dig som vill ha kortare, enklare meningar
• Rätta läxor med foto och få strukturerad återkoppling
• Planera veckans läxor, provförberedelser och studieplaner
• Lägg till flera barn och dela kalendern med den andra föräldern

BYGGT FÖR SVENSKA FÖRÄLDRAR
Allt är på svenska, kopplat till den svenska läroplanen Lgr22, och byggt med respekt för din och ditt barns integritet — vi säljer ingen data och spårar dig inte i tredjepartsverktyg.

Du behöver inte kunna ämnet själv. Börja med en bild eller en enkel fråga.
```
(≈1250 tecken — gott om marginal om du vill lägga till mer.)

## Nyckelord (max 100 tecken totalt, kommaseparerat, inga mellanslag efter komma)

```
läxhjälp,AI läxhjälp,föräldrar,läxor,Lgr22,skola,matte,grundskolan,läxplanering,AI skola
```
(Räkna om i App Store Connects egen räknare innan du sparar — deras fältgräns
räknas exakt, och listan ovan ligger nära gränsen.)

## Support-URL

```
https://foraldrahjalpen.se/contact
```
(Om kontaktsidan inte har en egen route utan bara nås via appens meny, använd
tills vidare `https://foraldrahjalpen.se/` — kontaktformuläret nås därifrån.)

## Marketing-URL (valfritt)

```
https://foraldrahjalpen.se
```

## Copyright

```
© 2026 Föräldrahjälpen
```

---

## App Privacy — sekretessdeklaration

App Store Connect → din app → **App Privacy** → **Get Started**. Baserat på
vad appen faktiskt samlar in (`src/components/PrivacyPolicy.tsx`):

| Datatyp | Samlas in? | Kopplad till användarens identitet? | Används för spårning? |
|---|---|---|---|
| Namn | Ja (konto: namn från Google-inloggning) | Ja | Nej |
| E-post | Ja | Ja | Nej |
| Foton/bilder | Ja (läxfoton som laddas upp för analys) | Ja | Nej |
| Användardata (chattinnehåll) | Ja (frågor/svar i AI-chatten) | Ja | Nej |
| Annan data (barnets förnamn + årskurs) | Ja | Ja (kopplad till förälderns konto) | Nej |

Svara **Nej** på "Data Used to Track You" rakt igenom — appen använder varken
Google Analytics, Facebook Pixel eller andra spårningsverktyg (bekräftat i
`PrivacyPolicy.tsx`: "Vi använder varken Google Analytics, Facebook Pixel
eller andra spårningsverktyg").

Ange **Privacy Policy URL**: `https://foraldrahjalpen.se/privacy` (fungerar
redan direkt utan inloggning, se tidigare ändring i den här sessionen).

## Age Rating-frågeformulär

Svara Nej/None på i princip alla frågor om våld, vuxet innehåll, gambling,
alkohol/droger, skräck, osv. — appen har inget sådant innehåll. Resultatet
blir sannolikt **4+**.

Ett par frågor värda extra eftertanke:
- **"Unrestricted Web Access"**: Nej — appen har ingen inbyggd webbläsare för
  fri surfning.
- **"User Generated Content"**: appen har chattmeddelanden och delning mellan
  föräldrar, men inget publikt/socialt flöde mellan främlingar — svara enligt
  Apples definition (troligen Nej, eftersom innehållet bara delas inom en
  privat familjekrets du själv bjuder in, inte publiceras).

## Kategori

Primär: **Education** (Utbildning). Sekundär (valfritt): **Productivity**.

## Skärmdumpar

Måste tas från den riktiga appen (se `APP_STORE_SUBMISSION.md` steg 7) i de
exakta pixelmått Apple kräver per enhetsklass — App Store Connect visar exakt
vilka mått som behövs när du laddar upp. Vanligast just nu: 6.9"/6.5"
iPhone-skärmdumpar (minst 3, max 10 st). Bra motiv utifrån appens faktiska
funktioner: chatten med ett fotograferat läxsvar, planeringsvyn, och
rättningsfunktionen.
