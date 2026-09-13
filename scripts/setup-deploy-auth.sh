#!/usr/bin/env bash
#
# Engångsuppsättning: låter GitHub Actions deploya Cloud Run och Firestore-reglerna
# utan nyckelfil.
#
# GitHub får utfärda en OIDC-token för varje körning. Google litar på den token
# via en Workload Identity-pool och växlar in den mot ett kortlivat åtkomsttoken
# för ett servicekonto. Ingen långlivad nyckel skapas, laddas ner eller lagras i
# GitHub — det enda som sparas där är två identifierare, som inte är hemligheter
# i sig men läggs som secrets ändå.
#
# Körs en gång, från din egen dator, där du redan är inloggad med `gcloud auth login`.
# Skriptet går att köra om: allt som redan finns återanvänds i stället för att skapa dubletter.
#
#   bash scripts/setup-deploy-auth.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-lead-agent-489101}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-laxhjalp-api}"
GITHUB_REPO="${GITHUB_REPO:-Nomarcus/svensk-laxhjalp}"

POOL="github-pool"
PROVIDER="github-provider"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

say() { printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }

command -v gcloud >/dev/null || { echo "gcloud saknas. Installera Google Cloud SDK först."; exit 1; }
gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q . \
  || { echo "Du är inte inloggad. Kör: gcloud auth login"; exit 1; }

say "Projekt: $PROJECT_ID   Repo: $GITHUB_REPO"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

say "Aktiverar nödvändiga API:er (tar en stund första gången)"
gcloud services enable \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebaserules.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  --project "$PROJECT_ID"

say "Servicekonto som utför deployen"
gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" \
    --display-name "GitHub Actions deployer" \
    --project "$PROJECT_ID"

say "Ger kontot de rättigheter deployerna behöver"
# Cloud Run: run.admin skapar ny revision, cloudbuild.builds.editor bygger imagen,
# artifactregistry.writer + storage.admin lagrar image respektive uppladdad källkod.
# Firestore: firebaserules.admin publicerar reglerna, datastore.indexAdmin hanterar
# indexen, firebase.viewer låter CLI:t läsa projektets metadata, datastore.user
# låter den schemalagda gallringen läsa och radera dokument.
for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/logging.viewer \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/firebase.viewer \
  roles/datastore.user
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:${SA_EMAIL}" \
    --role "$ROLE" \
    --condition=None \
    --quiet >/dev/null
  echo "   $ROLE"
done

say "Tillåter kontot att agera som tjänstens runtime-konto"
# Cloud Run kör tjänsten som ett eget konto. Den som deployar måste ha rätt att
# "agera som" det kontot, annars avvisas deployen. Läser av vilket det faktiskt är
# i stället för att gissa på standardkontot.
RUNTIME_SA="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" --project "$PROJECT_ID" \
  --format 'value(spec.template.spec.serviceAccountName)' 2>/dev/null || true)"
if [ -z "$RUNTIME_SA" ]; then
  RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  echo "   Hittade ingen befintlig tjänst — utgår från standardkontot"
fi
echo "   Runtime: $RUNTIME_SA"
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member "serviceAccount:${SA_EMAIL}" \
  --role roles/iam.serviceAccountUser \
  --project "$PROJECT_ID" \
  --quiet >/dev/null

say "Workload Identity-pool"
gcloud iam workload-identity-pools describe "$POOL" \
  --location global --project "$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" \
    --location global \
    --display-name "GitHub Actions" \
    --project "$PROJECT_ID"

say "Provider som litar på GitHubs OIDC-tokens"
# Villkoret är säkerhetsspärren: utan det skulle vilket GitHub-repo som helst i
# världen kunna växla in en token mot ditt servicekonto. Låser till ditt repo.
if gcloud iam workload-identity-pools providers describe "$PROVIDER" \
     --location global --workload-identity-pool "$POOL" \
     --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" --project "$PROJECT_ID" \
    --attribute-condition "assertion.repository == '${GITHUB_REPO}'" \
    --quiet
else
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" --project "$PROJECT_ID" \
    --display-name "GitHub" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition "assertion.repository == '${GITHUB_REPO}'"
fi

say "Kopplar repot till servicekontot"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  --quiet >/dev/null

PROVIDER_RESOURCE="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

say "Kontrollerar att workflowerna pekar på rätt projekt"
# Värdena står i klartext i workflowerna i stället för som GitHub-secrets, så att
# den här uppsättningen blir ett enda kommando utan klippa-och-klistra. Skulle
# projektnumret inte stämma vill vi veta det nu och inte som ett kryptiskt
# behörighetsfel i en körning om tre veckor.
WF_DIR=".github/workflows"
MISMATCH=0
for WF in "$WF_DIR/deploy-api.yml" "$WF_DIR/deploy-firestore.yml"; do
  [ -f "$WF" ] || { echo "   VARNING: hittar inte $WF"; MISMATCH=1; continue; }
  grep -qF "$PROVIDER_RESOURCE" "$WF" || { echo "   FEL i $WF: WIF_PROVIDER stämmer inte"; MISMATCH=1; }
  grep -qF "$SA_EMAIL" "$WF" || { echo "   FEL i $WF: DEPLOY_SA stämmer inte"; MISMATCH=1; }
done
if [ "$MISMATCH" = "1" ]; then
  cat <<EOF

  Workflowerna behöver dessa två rader under "env:":

    WIF_PROVIDER: ${PROVIDER_RESOURCE}
    DEPLOY_SA: ${SA_EMAIL}

  Rätta dem, committa och pusha. Sedan är allt klart.
EOF
  exit 1
fi
echo "   Stämmer"

# Google behöver någon minut på sig innan den nya providern går att använda.
say "Väntar 30 sekunder så behörigheterna hinner slå igenom"
sleep 30

say "Startar deployerna"
# Ändringarna som redan ligger i master triggar inga körningar retroaktivt, så de
# får en knuff här. Då är produktionen ikapp koden direkt efter uppsättningen.
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh workflow run deploy-api.yml --repo "$GITHUB_REPO" && echo "   API-deploy startad"
  gh workflow run deploy-firestore.yml --repo "$GITHUB_REPO" && echo "   Regel-deploy startad"
  cat <<EOF

────────────────────────────────────────────────────────────────
 Klart. Inget mer att göra — nu och framöver.
────────────────────────────────────────────────────────────────

Följ körningarna:  gh run watch --repo ${GITHUB_REPO}
eller              https://github.com/${GITHUB_REPO}/actions

Härifrån deployar varje push till master automatiskt:

  src/ m.m.             → Vercel
  server/ m.m.          → Cloud Run
  firestore.rules m.m.  → Firestore-regler

EOF
else
  cat <<EOF

────────────────────────────────────────────────────────────────
 Klart i Google Cloud.
────────────────────────────────────────────────────────────────

gh-kommandot saknas eller är inte inloggat, så jag kunde inte starta de
två första körningarna åt dig. Välj ett:

  Installera gh en gång och kör om det här skriptet:
      brew install gh && gh auth login

  Eller starta dem i webbläsaren, en gång:
      https://github.com/${GITHUB_REPO}/actions
      → välj workflow → "Run workflow"

Det gäller bara den allra första gången. Därefter deployar varje push
till master automatiskt.

EOF
fi
