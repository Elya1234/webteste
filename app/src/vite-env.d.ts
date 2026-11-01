/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_REMOTE_URL?: string;
  readonly VITE_SCHEDULE_URL?: string;
  readonly VITE_WEB_URL?: string;
}
