import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only service-role client. Bypasses RLS — must never be imported
// from a page or component, only from API route handlers.
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin must never be imported in client code');
}

let cached: SupabaseClient | null = null;

export const getSupabaseAdmin = (): SupabaseClient => {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Throw at call time, not module load, so builds and unrelated routes
  // still work when the key isn't configured yet.
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
};
