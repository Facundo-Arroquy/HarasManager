/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON: string
  /** URL base de la API del backend (ej. http://127.0.0.1:8000). Sin ella, ningún dominio usa la API. */
  readonly VITE_API_URL?: string
  /** Dominios que usan la API en vez de Supabase directo, separados por coma, o `*` para todos. */
  readonly VITE_API_DOMINIOS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
