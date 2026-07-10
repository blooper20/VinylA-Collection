import { NextRequest, NextResponse } from 'next/server';
import type { INQUIRY_REPLY } from '@vinyla/shared-types';
import { requireAdmin } from '../../../../../lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const { data, error } = await admin
    .from('INQUIRY')
    .select('*, INQUIRY_REPLY(*)')
    .eq('INQUIRY_ID', Number(id))
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  data.INQUIRY_REPLY = [...(data.INQUIRY_REPLY || [])].sort(
    (a: INQUIRY_REPLY, b: INQUIRY_REPLY) => a.CREATED_AT.localeCompare(b.CREATED_AT)
  );
  return NextResponse.json({ inquiry: data });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!['OPEN', 'ANSWERED', 'CLOSED'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('INQUIRY')
    .update({ STATUS: status, UPDATED_AT: new Date().toISOString() })
    .eq('INQUIRY_ID', Number(id))
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ inquiry: data });
}
