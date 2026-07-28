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

  if (existing?.COUNTRY_CODE === countryCode) {
    return NextResponse.json({ ok: true, countryCode, skipped: true });
  }

  const { error } = await admin
    .from('PROFILES')
    .upsert({ USER_ID: user.id, COUNTRY_CODE: countryCode });

  if (error) {
    console.error('geo capture failed:', error.message);
    return NextResponse.json({ error: 'geo capture failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, countryCode });
}
