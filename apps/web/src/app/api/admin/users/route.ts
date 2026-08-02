import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/adminAuth';

const PAGE = 1000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  try {
    // auth 유저 목록 + 보유/위시 집계 + 국가 코드는 서로 독립적인 스캔이라
    // 병렬로 돌려 지연시간을 줄인다 (기존엔 세 스캔이 전부 순차 실행됐음).
    const loadRawUsers = async () => {
      const rawUsers = [];
      let page = 1;
      for (;;) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
        if (error) throw error;
        rawUsers.push(...data.users);
        if (data.users.length < PAGE) break;
        page += 1;
      }
      return rawUsers;
    };

    const loadVinylCounts = async () => {
      const vinylCounts = new Map<string, { owned: number; wish: number }>();
      const { data: countsData, error: countsError } = await admin.rpc('get_user_vinyl_counts');

      if (!countsError && countsData) {
        for (const row of countsData) {
          vinylCounts.set(row.user_id, { owned: Number(row.owned), wish: Number(row.wish) });
        }
      } else {
        // Fallback: RPC가 아직 생성되지 않은 경우 전체 데이터를 가져와 JS 메모리에서 집계 (비효율적)
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
      }
      return vinylCounts;
    };

    // 국가 코드 일괄 조회 (x-vercel-ip-country로 로그인 시 자동 캡처됨)
    const loadCountryMap = async () => {
      const countryMap = new Map<string, string | null>();
      let from = 0;
      for (;;) {
        const { data, error } = await admin
          .from('PROFILES')
          .select('USER_ID, COUNTRY_CODE')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const r of data || []) countryMap.set(r.USER_ID, r.COUNTRY_CODE);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return countryMap;
    };

    const [rawUsers, vinylCounts, countryMap] = await Promise.all([
      loadRawUsers(),
      loadVinylCounts(),
      loadCountryMap(),
    ]);

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
        countryCode: countryMap.get(u.id) || null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({ users });
  } catch (e) {
    console.error('admin users failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'users query failed' }, { status: 500 });
  }
}
