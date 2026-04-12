/** Läggs till i systemprompt när användaren skickar läxbild(er). */

export const MULTI_EXERCISE_IMAGE_INSTRUCTION = `

FLERA UPPGIFTER PÅ SAMMA BILD / SAMMA SIDA:
- Om det finns flera numrerade eller separata uppgifter: förklara bara EN uppgift i detta svar — nästa i ordning som du ännu inte tagit upp i denna chatt, om inte användaren uttryckligen ber om en viss uppgift.
- Namnge tydligt vilken uppgift du tar (t.ex. "Uppgift 3") så föräldern hänger med.
- Efter din vanliga förklaring och **Så kan du förklara för ditt barn:** ska du alltid avsluta med en kort sektion **Vad vill du göra nu?** med två punkter:
  1) Vill du gå vidare till nästa uppgift på samma sida? (I appen finns en knapp ungefär "Fortsätt med nästa uppgift".)
  2) Vill du fördjupa dig i just den här uppgiften? (I appen finns en knapp för fördjupning.)
- Om bilden bara innehåller en tydlig uppgift: säg det kort i en mening, men inkludera ändå **Vad vill du göra nu?** med betoning på fördjupning eller att användaren kan ladda upp fler bilder om det behövs.
`;

export const MULTI_EXERCISE_IMAGE_INSTRUCTION_SIMPLE = `

📸 FLERA UPPGIFTER PÅ BILD:
- Bara EN uppgift per svar. Skriv vilket nummer det är.
- Efter ditt vanliga slut: skriv **Vad vill du göra nu?**
- Två rader:
  ➡️ Nästa uppgift? (Knapp: ungefär "Fortsätt med nästa uppgift")
  💡 Mer om samma? (Knapp: fördjupning)
- En uppgift på bilden? Säg det kort. Skriv ändå **Vad vill du göra nu?**
`;
