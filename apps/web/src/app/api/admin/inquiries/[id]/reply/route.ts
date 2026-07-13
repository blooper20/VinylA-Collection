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

// 관리자 답변 수정 — 문의 작성자가 아직 열람(READ_AT)하지 않은 답변만.
// 사용자가 이미 본 답변을 소리 없이 바꾸는 것을 막는 규칙의 서버 측 강제.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const replyId = Number(body?.replyId);
  const content = typeof body?.content === 'string' ? body.content.trim() : '';
  if (!Number.isSafeInteger(replyId) || !content) {
    return NextResponse.json({ error: 'replyId and content are required' }, { status: 400 });
  }

  const inquiryId = Number(id);
  const { data, error } = await admin
    .from('INQUIRY_REPLY')
    .update({ CONTENT: content })
    .eq('REPLY_ID', replyId)
    .eq('INQUIRY_ID', inquiryId)
    .eq('IS_ADMIN', true)
    .is('READ_AT', null)
    .select()
    .maybeSingle();

  if (error) {
    console.error('admin reply edit failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  if (!data) {
    // 조건 불일치 = 이미 사용자가 확인한 답변이거나 대상 없음
    return NextResponse.json({ error: 'already-read-or-missing' }, { status: 409 });
  }
  return NextResponse.json({ reply: data });
}
