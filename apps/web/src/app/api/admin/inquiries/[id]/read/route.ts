import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/adminAuth';

type Ctx = { params: Promise<{ id: string }> };

// 관리자가 문의를 열람했음을 기록한다. ADMIN_READ_AT이 찍히는 순간부터
// 작성자는 문의를 수정할 수 없다 ("관리자 확인 전까지 수정 가능" 규칙의
// 기준점). 최초 열람 시각만 의미가 있으므로 이미 찍혀 있으면 건드리지
// 않는다.
export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;
  const { id } = await ctx.params;

  const inquiryId = Number(id);
  if (!Number.isSafeInteger(inquiryId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const { error } = await admin
    .from('INQUIRY')
    .update({ ADMIN_READ_AT: new Date().toISOString() })
    .eq('INQUIRY_ID', inquiryId)
    .is('ADMIN_READ_AT', null);

  // 컬럼 마이그레이션 전이면 조용히 무시 — 열람 기록은 부가 기능이라
  // 관리자 화면 자체를 막으면 안 된다.
  if (error && !error.message?.includes('ADMIN_READ_AT')) {
    console.error('mark inquiry read failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
