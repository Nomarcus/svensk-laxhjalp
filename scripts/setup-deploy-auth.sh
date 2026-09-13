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
# indexen, firebase.viewer låter CLI:t läsa projektets metadata.
for ROLE in \
  roles/run.admin \
  roles/cloudbuild.builds.editor \
  roles/artifactregistry.writer \
  roles/storage.admin \
  roles/logging.viewer \
  roles/firebaserules.admin \
  roles/datastore.indexAdmin \
  roles/firebase.viewer
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

cat <<EOF

────────────────────────────────────────────────────────────────
 Klart i Google Cloud. Sista steget: lägg in två secrets i GitHub.
────────────────────────────────────────────────────────────────

Har du gh-kommandot installerat räcker det med att klistra in detta:

  gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --repo ${GITHUB_REPO} \\
    --body "${PROVIDER_RESOURCE}"
  gh secret set GCP_DEPLOY_SERVICE_ACCOUNT --repo ${GITHUB_REPO} \\
    --body "${SA_EMAIL}"

Annars i webbläsaren, under
https://github.com/${GITHUB_REPO}/settings/secrets/actions
→ "New repository secret", en för varje:

  GCP_WORKLOAD_IDENTITY_PROVIDER
  ${PROVIDER_RESOURCE}

  GCP_DEPLOY_SERVICE_ACCOUNT
  ${SA_EMAIL}

Samma två secrets används av båda workflowerna:

  server/ m.m.          → "Deploy API till Cloud Run"
  firestore.rules m.m.  → "Deploy Firestore-regler"

De körs automatiskt vid push till master. Testa direkt utan att pusha:
fliken Actions → välj workflow → "Run workflow".

EOF
