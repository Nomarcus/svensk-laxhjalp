#Requires -Version 5.1
<#
.SYNOPSIS
  Exporterar namngiven Firestore (EU) och kopierar till US-bucket för import till (default) i nam5.

  OBS: gcloud firestore IMPORT kan FELA med "content longer than 1500 bytes" (indexerade fält).
  Då: kör istället efter ADC-inloggning:
    gcloud auth application-default login
    npm run migrate:firestore

.PREREQUISITES
  gcloud + gsutil, firebase deploy för firestore.indexes.json (fieldOverrides för messages.content m.m.)
#>

$ErrorActionPreference = "Stop"

$PROJECT_ID = "lead-agent-489101"
$SOURCE_DATABASE = "ai-studio-8af631ef-cd5d-43bc-94dd-19902f5cf06f"
$BUCKET_EU = "gs://lead-agent-489101-firestore-migration"
$BUCKET_US = "gs://lead-agent-489101-fs-export-us"
$EXPORT_PREFIX = "export-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "Projekt: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# EU-bucket (samma region som käll-databas europe-west2)
if (-not (gsutil ls -b $BUCKET_EU 2>$null)) {
  gsutil mb -p $PROJECT_ID -l europe-west2 $BUCKET_EU
}

# US-bucket — (default) i nam5 accepterar bara US-buckets för import
if (-not (gsutil ls -b $BUCKET_US 2>$null)) {
  gsutil mb -p $PROJECT_ID -l us-central1 $BUCKET_US
}

Write-Host ">>> Export från $SOURCE_DATABASE ..."
gcloud firestore export "$BUCKET_EU/$EXPORT_PREFIX" --database=$SOURCE_DATABASE --project=$PROJECT_ID

$exportPath = "$BUCKET_EU/$EXPORT_PREFIX"
Write-Host ">>> Kopierar till US-bucket (krävs för import till nam5)..."
gsutil -m cp -r $exportPath "$BUCKET_US/"

$importUri = "$BUCKET_US/$EXPORT_PREFIX"
Write-Host ">>> Försöker managed import till (default) från $importUri ..."
gcloud firestore import $importUri --database="(default)" --project=$PROJECT_ID
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Import misslyckades troligen pga indexerade fält >1500 byte (t.ex. chat content)."
  Write-Host "Kör migrering via Admin SDK:"
  Write-Host "  gcloud auth application-default login"
  $repoRoot = Split-Path $PSScriptRoot -Parent
  Write-Host "  cd $repoRoot"
  Write-Host "  npm run migrate:firestore"
}
