import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/apiAuth';

// Vercel의 x-vercel-ip-country 헤더로 로그인 시점 국가를 자동 캡처한다.
// 로컬 dev/비-Vercel 환경은 헤더가 없어 조용히 스킵된다 (자기 입력 아님).
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const { user, admin } = auth;

  const countryCode = request.headers.get('x-vercel-ip-country');
  if (!countryCode) {
    return NextResponse.json({ ok: true, countryCode: null, skipped: true });
  }

  const { data: existing } = await admin
    .from('PROFILES')
    .select('COUNTRY_CODE')
    .eq('USER_ID', user.id)
    .maybeSingle();

  // 아직 온보딩(닉네임 설정) 전이라 PROFILES 행이 없는 유저 — DISPLAY_NAME
  // NOT NULL 제약 때문에 여기서 행을 새로 만들 수 없다. /setup에서 행이
  // 생성된 직후 캡처가 재시도되므로 지금은 건너뛴다.
  if (!existing) {
    return NextResponse.json({ ok: true, countryCode, skipped: true });
  }

  if (existing.COUNTRY_CODE === countryCode) {
    return NextResponse.json({ ok: true, countryCode, skipped: true });
  }

  // upsert는 대상 행이 이미 있어도 Postgres가 ON CONFLICT 판단 전에 제안된
  // INSERT 튜플부터 NOT NULL 제약으로 검증하기 때문에, DISPLAY_NAME을 뺀
  // upsert는 기존 행이 있어도 그대로 실패한다 — 반드시 UPDATE를 써야 한다.
  const { error } = await admin
    .from('PROFILES')
    .update({ COUNTRY_CODE: countryCode })
    .eq('USER_ID', user.id);

  if (error) {
    console.error('geo capture failed:', error.message);
    return NextResponse.json({ error: 'geo capture failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, countryCode });
}
