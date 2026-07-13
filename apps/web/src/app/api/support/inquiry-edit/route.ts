import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';
import { InquiryCategory } from '@vinyla/shared-types';

const CATEGORIES: InquiryCategory[] = ['COMPLAINT', 'SUGGESTION', 'BUG', 'GENERAL'];

// 작성자가 자기 문의를 수정한다 — 관리자가 아직 열람(ADMIN_READ_AT)하지
// 않았을 때만. INQUIRY에는 클라이언트 UPDATE 정책이 없으므로(의도),
// 이 라우트가 소유권·미열람 조건을 검증하고 service role로 수정한다.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json().catch(() => null);
  const inquiryId = Number(body?.inquiryId);
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 100) : '';
  const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 2000) : '';
  const category = CATEGORIES.includes(body?.category) ? (body.category as InquiryCategory) : null;
  if (!Number.isSafeInteger(inquiryId) || !title || !content || !category) {
    return NextResponse.json({ error: 'inquiryId, category, title, content are required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('INQUIRY')
    .update({ CATEGORY: category, TITLE: title, CONTENT: content, UPDATED_AT: new Date().toISOString() })
    .eq('INQUIRY_ID', inquiryId)
    .eq('USER_ID', user.id)
    .is('ADMIN_READ_AT', null)
    .select()
    .maybeSingle();

  if (error) {
    console.error('inquiry edit failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  if (!data) {
    // 관리자가 이미 확인했거나 내 문의가 아님
    return NextResponse.json({ error: 'already-read-or-missing' }, { status: 409 });
  }
  return NextResponse.json({ inquiry: data });
}
