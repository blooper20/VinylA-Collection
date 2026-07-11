import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';

type UserAuthResult =
  | { error: NextResponse; user?: undefined; admin?: undefined }
  | { error?: undefined; user: User; admin: SupabaseClient };

// Gate for cost-bearing proxy routes (AI scan 등): verifies the caller's
// Bearer token against Supabase. Unlike requireAdmin, any signed-in user
// passes — the point is to stop anonymous abuse of paid third-party APIs.
export const requireUser = async (request: NextRequest): Promise<UserAuthResult> => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  let admin: SupabaseClient;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return { error: NextResponse.json({ error: 'api not configured' }, { status: 500 }) };
  }

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  return { user, admin };
};
