import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';

// 문의 작성자가 스레드를 열람했음을 기록한다 — 해당 문의의 관리자 답변 중
// 아직 안 읽은 것들에 READ_AT을 찍는다. 이 순간부터 관리자는 그 답변을
// 수정할 수 없다 ("사용자 확인 전까지 수정 가능" 규칙의 기준점).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const body = await request.json().catch(() => null);
  const inquiryId = Number(body?.inquiryId);
  if (!Number.isSafeInteger(inquiryId)) {
    return NextResponse.json({ error: 'inquiryId is required' }, { status: 400 });
  }

  // 소유권 확인 (남의 문의 답변을 읽음 처리할 수 없다)
  const { data: inq } = await admin
    .from('INQUIRY')
    .select('USER_ID')
    .eq('INQUIRY_ID', inquiryId)
    .maybeSingle();
  if (!inq || inq.USER_ID !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { error } = await admin
    .from('INQUIRY_REPLY')
    .update({ READ_AT: new Date().toISOString() })
    .eq('INQUIRY_ID', inquiryId)
    .eq('IS_ADMIN', true)
    .is('READ_AT', null);

  // 컬럼 마이그레이션 전이면 조용히 무시 (부가 기능)
  if (error && !error.message?.includes('READ_AT')) {
    console.error('mark replies read failed:', error.message);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
