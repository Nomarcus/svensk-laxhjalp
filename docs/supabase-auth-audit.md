# Supabase auth-audit (Google + anonym gäst)

## Sammanfattning av identifierade brister

1. **Google-inloggning kastade inte fel i klienten**.
   - `signInWithGoogle` returnerade Supabase-svaret utan att kasta `error`.
   - Konsekvens: UI kunde fastna i loading-läge utan tydligt felmeddelande när OAuth-start misslyckades.

2. **Google redirect var för oprecis**.
   - Redirect gick till `window.location.origin` i stället för en tydlig callback-URL.
   - Konsekvens: risk för mismatch mot tillåtna redirect-URL:er i Supabase/Google-konfiguration.

3. **Felmeddelanden för auth-migreringen var inte tillräckligt diagnostiska**.
   - Vanliga Supabase-fel för Google provider och anonym inloggning översattes inte till handlingsbara texter.

## Kodförbättringar i denna patch

- `signInWithGoogle` är nu `async`, kastar Supabase-fel, och använder explicit callback: `VITE_SITE_URL/auth/callback` (fallback till `window.location.origin`).
- `Auth.handleError` har fått tydliga meddelanden för:
  - anonym inloggning ej aktiverad
  - Google provider ej aktiverad
  - ogiltiga login credentials

## Operativ checklista i Supabase Dashboard

### A. Google OAuth

1. Gå till **Supabase → Authentication → Providers → Google**.
2. Säkerställ att Google provider är **Enabled**.
3. Lägg in korrekt Client ID/Client Secret från Google Cloud Console.
4. Kontrollera att följande redirect-URL finns med i Google Cloud OAuth-klienten:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
5. Gå till **Supabase → Authentication → URL Configuration** och verifiera:
   - `Site URL` (exakt domän för frontend)
   - `Redirect URLs` inkluderar:
     - `https://din-domän/auth/callback`
     - `http://localhost:5173/auth/callback` (lokalt)

### B. Anonym inloggning

1. Gå till **Supabase → Authentication → Providers → Anonymous Sign-Ins**.
2. Säkerställ att funktionen är **Enabled**.
3. Om Bot Protection/CAPTCHA används: verifiera att klienten skickar nödvändigt captcha-token.

### C. Frontend miljövariabler

Kontrollera att frontend-miljön innehåller:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (rekommenderad i prod)

## Testplan (snabb)

1. Starta appen lokalt och öppna auth-sidan.
2. Testa Google-inloggning:
   - Förväntat: redirect till Google och tillbaka till `/auth/callback`.
3. Testa anonym inloggning:
   - Förväntat: session skapas och appen renderar huvudlayout.
4. Bekräfta att `users`-raden skapas/uppdateras i tabellen `public.users`.
5. Kör ett API-anrop (`/api/chat`) och verifiera att Bearer-token accepteras.

## Felsökning om det fortfarande brister

- **"provider is not enabled"**: Google provider är avstängd i Supabase.
- **"Anonymous sign-ins are disabled"**: slå på Anonymous provider i Supabase.
- **401 från `/api/chat` efter login**: kontrollera att frontend skickar `Authorization: Bearer <access_token>` och att servern har rätt `SUPABASE_SERVICE_ROLE_KEY`.
- **OAuth redirect mismatch**: jämför exakt callback-domän/protokoll (https vs http) mellan frontend, Supabase URL config och Google Cloud Console.
