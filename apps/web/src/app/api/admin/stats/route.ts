import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../../../lib/adminAuth';

const PAGE = 1000;

// supabase-js silently caps selects at 1000 rows — page through with .range()
const fetchAll = async <T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> => {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

// UTC timestamps bucketed to Korean calendar days ('sv-SE' → YYYY-MM-DD)
const toKstDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

const listAllUsers = async (admin: SupabaseClient) => {
  const users: { id: string; created_at: string; deleted: boolean }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    for (const u of data.users) {
      users.push({
        id: u.id,
        created_at: u.created_at,
        deleted: u.user_metadata?.del_yn === 'N',
      });
    }
    if (data.users.length < PAGE) break;
    page += 1;
  }
  return users;
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();
  const prevSinceIso = new Date(sinceMs - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [users, ownedCountRes, wishCountRes, openInquiriesRes, events, ownedRows] = await Promise.all([
      listAllUsers(admin),
      admin.from('USER_VINYL').select('*', { count: 'exact', head: true }).eq('STATUS', 'OWNED'),
      admin.from('USER_VINYL').select('*', { count: 'exact', head: true }).eq('STATUS', 'WISH'),
      admin.from('INQUIRY').select('*', { count: 'exact', head: true }).eq('STATUS', 'OPEN'),
      fetchAll<{ EVENT_TYPE: string; CREATED_AT: string }>((from, to) =>
        admin.from('EVENT_LOG').select('EVENT_TYPE, CREATED_AT').gte('CREATED_AT', sinceIso).range(from, to)
      ),
      fetchAll<{ USER_ID: string; ALBUM_ID: number }>((from, to) =>
        admin.from('USER_VINYL').select('USER_ID, ALBUM_ID').eq('STATUS', 'OWNED').range(from, to)
      ),
    ]);

    // ── KPIs ────────────────────────────────────────────────
    const activeUsers = users.filter((u) => !u.deleted);
    const newInPeriod = activeUsers.filter((u) => u.created_at >= sinceIso).length;
    const newInPrevPeriod = activeUsers.filter(
      (u) => u.created_at >= prevSinceIso && u.created_at < sinceIso
    ).length;

    // ── 가입자 추이 (일별, 0 채움) ───────────────────────────
    const signupByDay = new Map<string, number>();
    for (const u of activeUsers) {
      if (u.created_at >= sinceIso) {
        const d = toKstDate(u.created_at);
        signupByDay.set(d, (signupByDay.get(d) || 0) + 1);
      }
    }
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(toKstDate(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()));
    }
    const signupTrend = dayKeys.map((date) => ({ date, count: signupByDay.get(date) || 0 }));

    // ── 이벤트 시리즈 (일 × 타입) ────────────────────────────
    const eventTypes = Array.from(new Set(events.map((e) => e.EVENT_TYPE))).sort();
    const eventByDay = new Map<string, Record<string, number>>();
    for (const e of events) {
      const d = toKstDate(e.CREATED_AT);
      const row = eventByDay.get(d) || {};
      row[e.EVENT_TYPE] = (row[e.EVENT_TYPE] || 0) + 1;
      eventByDay.set(d, row);
    }
    const eventSeries = dayKeys.map((date) => {
      const row: Record<string, number | string> = { date };
      for (const t of eventTypes) row[t] = eventByDay.get(date)?.[t] || 0;
      return row;
    });

    // ── 장르 분포 Top 10 ─────────────────────────────────────
    const ownedAlbumIds = Array.from(new Set(ownedRows.map((r) => r.ALBUM_ID)));
    const genreCount = new Map<string, number>();
    // .in() 필터는 URL 길이 제한이 있어 500개씩 끊어 조회
    for (let i = 0; i < ownedAlbumIds.length; i += 500) {
      const chunk = ownedAlbumIds.slice(i, i + 500);
      const tags = await fetchAll<{ TAG_NAME: string }>((from, to) =>
        admin.from('VINYL_TAG').select('TAG_NAME').eq('TAG_TYPE', 'GENRE').in('ALBUM_ID', chunk).range(from, to)
      );
      for (const t of tags) {
        genreCount.set(t.TAG_NAME, (genreCount.get(t.TAG_NAME) || 0) + 1);
      }
    }
    const genreDist = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    // ── 컬렉션 규모 분포 ─────────────────────────────────────
    const perUserOwned = new Map<string, number>();
    for (const r of ownedRows) {
      perUserOwned.set(r.USER_ID, (perUserOwned.get(r.USER_ID) || 0) + 1);
    }
    const buckets = [
      { bucket: '0장', min: 0, max: 0 },
      { bucket: '1-5장', min: 1, max: 5 },
      { bucket: '6-10장', min: 6, max: 10 },
      { bucket: '11-20장', min: 11, max: 20 },
      { bucket: '21-50장', min: 21, max: 50 },
      { bucket: '50장+', min: 51, max: Infinity },
    ];
    const counts = new Array(buckets.length).fill(0);
    counts[0] = Math.max(0, activeUsers.length - perUserOwned.size);
    for (const n of perUserOwned.values()) {
      const idx = buckets.findIndex((b) => n >= b.min && n <= b.max);
      if (idx >= 0) counts[idx] += 1;
    }
    const collectionHistogram = buckets.map((b, i) => ({ bucket: b.bucket, users: counts[i] }));

    return NextResponse.json({
      days,
      kpis: {
        totalUsers: activeUsers.length,
        deletedUsers: users.length - activeUsers.length,
        newUsers: newInPeriod,
        newUsersDelta: newInPeriod - newInPrevPeriod,
        ownedCount: ownedCountRes.count || 0,
        wishCount: wishCountRes.count || 0,
        openInquiries: openInquiriesRes.count || 0,
      },
      signupTrend,
      eventTypes,
      eventSeries,
      genreDist,
      collectionHistogram,
    });
  } catch (e: any) {
    console.error('admin stats failed:', e?.message || e);
    return NextResponse.json({ error: 'stats aggregation failed' }, { status: 500 });
  }
}
