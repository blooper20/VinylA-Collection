import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin, user } = auth;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const inquiryId = Number(id);
  const { data: reply, error } = await admin
    .from('INQUIRY_REPLY')
    .insert({
      INQUIRY_ID: inquiryId,
      USER_ID: user.id,
      IS_ADMIN: true,
      CONTENT: content,
    })
    .select()
    .single();

  if (error) {
    console.error('admin reply failed:', error.message);
    return NextResponse.json({ error: 'reply failed' }, { status: 500 });
  }

  // 답변이 달리면 문의 상태를 자동으로 ANSWERED로
  await admin
    .from('INQUIRY')
    .update({ STATUS: 'ANSWERED', UPDATED_AT: new Date().toISOString() })
    .eq('INQUIRY_ID', inquiryId);

  return NextResponse.json({ reply });
}
