import { Shield, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
  return (
    <div className="min-h-screen bg-[#F5F5F0] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-stone-500 hover:text-stone-700 mb-6 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Tillbaka</span>
        </button>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-serif italic">Integritetspolicy</h1>
              <p className="text-xs text-stone-400 uppercase tracking-widest">Senast uppdaterad: mars 2026</p>
            </div>
          </div>

          <div className="prose prose-stone prose-sm max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-medium">Vilka data samlar vi in?</h2>
              <p>
                Vi samlar in den information du anger vid inloggning via Google (namn, e-postadress och profilbild).
                Dessutom sparas de meddelanden och uppgifter du skapar i appen i Firebase Firestore.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium">Hur används dina data?</h2>
              <ul>
                <li>För att tillhandahålla och förbättra läxhjälpstjänsten.</li>
                <li>För att spara dina chattkonversationer och planerade uppgifter.</li>
                <li>Dina meddelanden skickas till Google Gemini AI för att generera svar. Inga meddelanden sparas av AI-tjänsten.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-medium">Delning av data</h2>
              <p>
                Vi delar inte dina data med tredje part, förutom Google Firebase (för lagring och autentisering)
                och Google Gemini AI (för AI-genererade svar). Båda tjänsterna hanteras enligt Googles integritetspolicy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-medium">Dina rättigheter (GDPR)</h2>
              <p>Som EU-medborgare har du rätt att:</p>
              <ul>
                <li>Begära tillgång till dina personuppgifter.</li>
                <li>Begära rättelse eller radering av dina uppgifter.</li>
                <li>Radera ditt konto och all tillhörande data.</li>
              </ul>
              <p>Kontakta oss via e-post för att utöva dina rättigheter.</p>
            </section>

            <section>
              <h2 className="text-lg font-medium">Cookies</h2>
              <p>
                Vi använder endast nödvändiga cookies för autentisering via Firebase. Inga spårningscookies eller tredjepartscookies används.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
