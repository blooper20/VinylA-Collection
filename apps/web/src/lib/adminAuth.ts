import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';

type AdminAuthResult =
  | { error: NextResponse; user?: undefined; admin?: undefined }
  | { error?: undefined; user: User; admin: SupabaseClient };

// Single gate for every /api/admin/* route: verifies the caller's Bearer
// token against Supabase and requires app_metadata.role === 'admin'
// (app_metadata is only writable with the service role, so users can't
// self-promote). Only after this passes may the service-role client be
// used for RLS-bypassing queries.
export const requireAdmin = async (request: NextRequest): Promise<AdminAuthResult> => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  let admin: SupabaseClient;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return { error: NextResponse.json({ error: 'admin api not configured' }, { status: 500 }) };
  }

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  if (user.app_metadata?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }

  return { user, admin };
};
