import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with fallback for UI development without env vars
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key';

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.error(
    '[vinyla] SUPABASE_URL env var is missing — running against a placeholder client. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL (web) or EXPO_PUBLIC_SUPABASE_URL (mobile).'
  );
}

// React Native has no localStorage, so supabase-js falls back to in-memory
// storage there and the session is lost on every app restart. The mobile
// entrypoint (apps/mobile/index.ts) sets this global to AsyncStorage BEFORE
// this module loads; on web it stays undefined and the browser default
// (localStorage) is used. A global is used instead of an import so this
// shared package never pulls react-native modules into the Next.js bundle.
const nativeAuthStorage = (globalThis as any).__VINYLA_SUPABASE_STORAGE__;

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  nativeAuthStorage
    ? {
        auth: {
          storage: nativeAuthStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }
    : undefined
);
