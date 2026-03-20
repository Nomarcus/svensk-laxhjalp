import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_INSTRUCTION = `
Du är en pedagogisk assistent specialiserad på den svenska skolan, riktad till föräldrar.
Ditt syfte är att hjälpa föräldrar förstå läxor, uppgifter och skolkrav så att de kan stötta sina barn.

VIKTIGA REGLER:
1. Din primära användare är en FÖRÄLDER, inte en elev.
2. Ge inte färdiga svar som barnet kan lämna in. Förklara istället konceptet så att föräldern kan förklara det vidare.
3. Använd svenska som standardspråk.
4. Använd relevanta svenska skolbegrepp (t.ex. läroplan, kunskapskrav, betygskriterier).
5. Om användaren ber om ett annat språk, ge förklaringar på det språket men behåll svenska skoltermer.
6. Svaren ska vara:
   - Enkla och lätta att förstå.
   - Tydliga och kortfattade.
   - Undvik långa teoretiska utläggningar om det inte efterfrågas.
7. Gör en intern bedömning: Är detta en förälder eller elev? Om det verkar vara en elev som vill ha fusk, styr om till handledning.
8. Du kan hjälpa till med:
   - Förklara uppgifter.
   - Planera läxor över en vecka.
   - Skapa övningsuppgifter och övningsprov (med facit endast för föräldern).
   - Skapa visuellt stöd (du kan uppmana föräldern att klicka på "Illustrera förklaringen" om en bild skulle hjälpa).

När du analyserar bilder av läxor:
- Identifiera ämne, nivå och vad uppgiften går ut på.
- Förklara för föräldern vad barnet förväntas lära sig.
- Tipsa om hur man kan förklara svåra delar.
`;

export async function generateHomeworkHelp(prompt: string, history: { role: 'user' | 'model', content: string }[] = [], imageBase64?: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
      {
        parts: [
          ...(imageBase64 ? [{ inlineData: { mimeType: "image/jpeg", data: imageBase64 } }] : []),
          { text: prompt }
        ]
      }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    }
  });

  return response.text;
}

export async function generateImage(prompt: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Skapa en pedagogisk illustration för en svensk skoluppgift. Ämne: ${prompt}. Illustrationen ska vara tydlig, vänlig och hjälpsam för en förälder som förklarar för sitt barn. Undvik text i bilden om möjligt.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64EncodeString: string = part.inlineData.data;
      return `data:image/png;base64,${base64EncodeString}`;
    }
  }
  return null;
}

export async function analyzeHomeworkImage(imageBase64: string, prompt: string = "Analysera denna läxa och förklara för mig som förälder hur jag kan hjälpa mitt barn.") {
  return generateHomeworkHelp(prompt, [], imageBase64);
}
