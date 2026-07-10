import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminAuth';

const PAGE = 1000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  try {
    const rawUsers = [];
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
      if (error) throw error;
      rawUsers.push(...data.users);
      if (data.users.length < PAGE) break;
      page += 1;
    }

    // 사용자별 보유/위시 장수
    const vinylCounts = new Map<string, { owned: number; wish: number }>();
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from('USER_VINYL')
        .select('USER_ID, STATUS')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const r of data || []) {
        const c = vinylCounts.get(r.USER_ID) || { owned: 0, wish: 0 };
        if (r.STATUS === 'OWNED') c.owned += 1;
        else if (r.STATUS === 'WISH') c.wish += 1;
        vinylCounts.set(r.USER_ID, c);
      }
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }

    const users = rawUsers
      .map((u) => ({
        id: u.id,
        email: u.email || '',
        displayName: u.user_metadata?.displayName || '',
        provider: u.app_metadata?.provider || 'unknown',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        // 이 프로젝트 컨벤션: del_yn === 'N' 이 탈퇴 상태
        deleted: u.user_metadata?.del_yn === 'N',
        owned: vinylCounts.get(u.id)?.owned || 0,
        wish: vinylCounts.get(u.id)?.wish || 0,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ users });
  } catch (e) {
    console.error('admin users failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'users query failed' }, { status: 500 });
  }
}
