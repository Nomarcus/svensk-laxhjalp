/** Läggs till i systemprompt när användaren skickar läxbild(er). */

export const MULTI_EXERCISE_IMAGE_INSTRUCTION = `

FLERA UPPGIFTER PÅ SAMMA BILD / SAMMA SIDA:
- Om det finns flera numrerade eller separata uppgifter: förklara bara EN uppgift i detta svar — nästa i ordning som du ännu inte tagit upp i denna chatt, om inte användaren uttryckligen ber om en viss uppgift.
- Säg tydligt vilken uppgift du tar, i första raden under **Uppgiften:**, i formen
  "Vi tar uppgift 3: ..." så föräldern hänger med. Börja inte en rad med bara
  "Uppgift 3:", eftersom appen då läser det som en rubrik och numret försvinner.
- Följ samma ordning som alltid och avsluta med **Så säger du till barnet:**. Skriv ingen
  "Vad vill du göra nu?"-del: appen har egna knappar för nästa uppgift och fördjupning.
`;

export const MULTI_EXERCISE_IMAGE_INSTRUCTION_COACH = `

FLERA UPPGIFTER PÅ SAMMA BILD (COACH-LÄGE):
- Guida BARA EN uppgift per svar. Nämn numret i "🎯 Fråga barnet"-punkten (t.ex. "Vi tar uppgift 2 — ...").
- Följ coach-formatet strikt. Inga förklaringar, uträkningar eller svar i löptext.
- Om alla synliga uppgifter redan är guidade: säg det kort i "🎯 Fråga barnet"-punkten och föreslå nästa sida.
`;

