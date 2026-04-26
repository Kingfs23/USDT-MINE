import { isSupabaseConfigured, supabaseConfig } from "./supabase-config.js";

const createClient = window.supabase?.createClient;

export const supabase =
  isSupabaseConfigured && createClient
    ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
