import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminAuth';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const status = request.nextUrl.searchParams.get('status');

  try {
    let query = admin
      .from('INQUIRY')
      .select('*, INQUIRY_REPLY(*)')
      .order('CREATED_AT', { ascending: false })
      .limit(200);
    if (status && ['OPEN', 'ANSWERED', 'CLOSED'].includes(status)) {
      query = query.eq('STATUS', status);
    }
    const { data: inquiries, error } = await query;
    if (error) throw error;

    // 작성자 닉네임 수동 조인 (PROFILES가 없으면 이메일 앞부분으로 폴백)
    const userIds = Array.from(new Set((inquiries || []).map((i: any) => i.USER_ID)));
    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('PROFILES')
        .select('USER_ID, DISPLAY_NAME')
        .in('USER_ID', userIds);
      for (const p of profiles || []) nameMap.set(p.USER_ID, p.DISPLAY_NAME);

      const missing = userIds.filter((id) => !nameMap.has(id));
      for (const id of missing) {
        const { data } = await admin.auth.admin.getUserById(id);
        const u = data?.user;
        nameMap.set(
          id,
          u?.user_metadata?.displayName || u?.email?.split('@')[0] || '(알 수 없음)'
        );
      }
    }

    const result = (inquiries || []).map((i: any) => ({
      ...i,
      INQUIRY_REPLY: [...(i.INQUIRY_REPLY || [])].sort((a: any, b: any) =>
        a.CREATED_AT.localeCompare(b.CREATED_AT)
      ),
      DISPLAY_NAME: nameMap.get(i.USER_ID) || '(알 수 없음)',
    }));

    return NextResponse.json({ inquiries: result });
  } catch (e: any) {
    console.error('admin inquiries list failed:', e?.message || e);
    return NextResponse.json({ error: 'failed to list inquiries' }, { status: 500 });
  }
}
