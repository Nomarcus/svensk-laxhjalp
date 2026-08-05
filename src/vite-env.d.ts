/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_UID?: string;
  readonly VITE_ADMIN_EMAIL?: string;
  /** Valfri override av API-rot (standard i prod: Cloud Run i apiBase.ts). */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
