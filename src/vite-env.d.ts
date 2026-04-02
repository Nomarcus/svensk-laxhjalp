/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_UID?: string;
  readonly VITE_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
