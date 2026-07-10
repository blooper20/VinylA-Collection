import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../../../lib/adminAuth';

const PAGE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_WEEKS = 8;

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

const kstParts = (iso: string): { dow: number; hour: number } => {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const dowName = parts.find((p) => p.type === 'weekday')?.value || 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dowName);
  return { dow: dow < 0 ? 0 : dow, hour };
};

type AdminUser = {
  id: string;
  created_at: string;
  deleted: boolean;
  hasProfile: boolean;
  provider: string;
};

const listAllUsers = async (admin: SupabaseClient): Promise<AdminUser[]> => {
  const users: AdminUser[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw error;
    for (const u of data.users) {
      users.push({
        id: u.id,
        created_at: u.created_at,
        deleted: u.user_metadata?.del_yn === 'N',
        hasProfile: !!u.user_metadata?.displayName,
        provider: u.app_metadata?.provider || 'unknown',
      });
    }
    if (data.users.length < PAGE) break;
    page += 1;
  }
  return users;
};

type EventRow = {
  EVENT_TYPE: string;
  USER_ID: string | null;
  CREATED_AT: string;
  META: Record<string, any> | null;
};
type VinylRow = { USER_ID: string; ALBUM_ID: number; STATUS: string; PURCHASE_PRICE: number | null };

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin } = auth;

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;
  const now = Date.now();
  const sinceMs = now - days * DAY_MS;
  const sinceIso = new Date(sinceMs).toISOString();
  const prevSinceIso = new Date(sinceMs - days * DAY_MS).toISOString();
  // 이벤트는 리텐션 코호트/휴면 계산을 위해 기간 필터와 무관하게 최근 8주 확보
  const eventWindowIso = new Date(
    Math.min(sinceMs, now - COHORT_WEEKS * 7 * DAY_MS)
  ).toISOString();

  try {
    const [users, openInquiriesRes, events, vinylRows, wishConvertRes] =
      await Promise.all([
        listAllUsers(admin),
        admin.from('INQUIRY').select('*', { count: 'exact', head: true }).eq('STATUS', 'OPEN'),
        fetchAll<EventRow>((from, to) =>
          admin
            .from('EVENT_LOG')
            .select('EVENT_TYPE, USER_ID, CREATED_AT, META')
            .gte('CREATED_AT', eventWindowIso)
            .range(from, to)
        ),
        fetchAll<VinylRow>((from, to) =>
          admin.from('USER_VINYL').select('USER_ID, ALBUM_ID, STATUS, PURCHASE_PRICE').range(from, to)
        ),
        admin
          .from('EVENT_LOG')
          .select('*', { count: 'exact', head: true })
          .eq('EVENT_TYPE', 'ALBUM_ADD')
          .contains('META', { fromWish: true })
          .gte('CREATED_AT', sinceIso),
      ]);

    const activeUsers = users.filter((u) => !u.deleted);
    const periodEvents = events.filter((e) => e.CREATED_AT >= sinceIso);
    const ownedRows = vinylRows.filter((r) => r.STATUS === 'OWNED');
    const wishRows = vinylRows.filter((r) => r.STATUS === 'WISH');

    // ── KPI: 가입/신규 ───────────────────────────────────────
    const newInPeriod = activeUsers.filter((u) => u.created_at >= sinceIso).length;
    const newInPrevPeriod = activeUsers.filter(
      (u) => u.created_at >= prevSinceIso && u.created_at < sinceIso
    ).length;

    // ── B1. DAU / WAU / MAU + stickiness ────────────────────
    const activeSince = (ms: number) => {
      const iso = new Date(ms).toISOString();
      return new Set(events.filter((e) => e.USER_ID && e.CREATED_AT >= iso).map((e) => e.USER_ID)).size;
    };
    // DAU는 dauTrend 차트와 같은 기준(KST 달력일)으로 — 롤링 24h와 섞이지 않게
    const todayKst = toKstDate(new Date(now).toISOString());
    const dau = new Set(
      events.filter((e) => e.USER_ID && toKstDate(e.CREATED_AT) === todayKst).map((e) => e.USER_ID)
    ).size;
    const wau = activeSince(now - 7 * DAY_MS);
    const mau = activeSince(now - 30 * DAY_MS);
    const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

    // ── B4. 휴면 (최근 14일 무활동) ──────────────────────────
    const active14 = activeSince(now - 14 * DAY_MS);
    const dormantUsers = Math.max(0, activeUsers.length - active14);

    // ── 일별 추이 (가입 + DAU) ───────────────────────────────
    const dayKeys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      dayKeys.push(toKstDate(new Date(now - i * DAY_MS).toISOString()));
    }
    const signupByDay = new Map<string, number>();
    for (const u of activeUsers) {
      if (u.created_at >= sinceIso) {
        const d = toKstDate(u.created_at);
        signupByDay.set(d, (signupByDay.get(d) || 0) + 1);
      }
    }
    const signupTrend = dayKeys.map((date) => ({ date, count: signupByDay.get(date) || 0 }));

    const dauByDay = new Map<string, Set<string>>();
    for (const e of periodEvents) {
      if (!e.USER_ID) continue;
      const d = toKstDate(e.CREATED_AT);
      if (!dauByDay.has(d)) dauByDay.set(d, new Set());
      dauByDay.get(d)!.add(e.USER_ID);
    }
    const dauTrend = dayKeys.map((date) => ({ date, count: dauByDay.get(date)?.size || 0 }));

    // ── B5. 요일 × 시간 활동 히트맵 ──────────────────────────
    const heatCells = new Map<string, number>();
    for (const e of periodEvents) {
      const { dow, hour } = kstParts(e.CREATED_AT);
      const key = `${dow}-${hour}`;
      heatCells.set(key, (heatCells.get(key) || 0) + 1);
    }
    const heatmap: { dow: number; hour: number; count: number }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ dow, hour, count: heatCells.get(`${dow}-${hour}`) || 0 });
      }
    }

    // ── B2. 주간 가입 코호트 리텐션 ──────────────────────────
    const eventWeeksByUser = new Map<string, Set<number>>();
    for (const e of events) {
      if (!e.USER_ID) continue;
      if (!eventWeeksByUser.has(e.USER_ID)) eventWeeksByUser.set(e.USER_ID, new Set());
      eventWeeksByUser.get(e.USER_ID)!.add(Math.floor(new Date(e.CREATED_AT).getTime() / (7 * DAY_MS)));
    }
    const nowWeek = Math.floor(now / (7 * DAY_MS));
    const retentionCohorts: { cohort: string; size: number; weeks: (number | null)[] }[] = [];
    for (let c = COHORT_WEEKS - 1; c >= 0; c--) {
      const cohortWeek = nowWeek - c;
      const cohortUsers = activeUsers.filter(
        (u) => Math.floor(new Date(u.created_at).getTime() / (7 * DAY_MS)) === cohortWeek
      );
      const label = toKstDate(new Date(cohortWeek * 7 * DAY_MS).toISOString()).slice(5);
      const weeks: (number | null)[] = [];
      for (let w = 0; w < COHORT_WEEKS; w++) {
        const targetWeek = cohortWeek + w;
        if (targetWeek > nowWeek) {
          weeks.push(null); // 아직 오지 않은 주차
        } else if (cohortUsers.length === 0) {
          weeks.push(0);
        } else {
          const retained = cohortUsers.filter((u) => eventWeeksByUser.get(u.id)?.has(targetWeek)).length;
          weeks.push(Math.round((retained / cohortUsers.length) * 100));
        }
      }
      retentionCohorts.push({ cohort: label, size: cohortUsers.length, weeks });
    }

    // ── A1. 활성화 퍼널 ──────────────────────────────────────
    const usersWithVinyl = new Set(vinylRows.map((r) => r.USER_ID));
    const funnel = {
      signedUp: activeUsers.length,
      profileDone: activeUsers.filter((u) => u.hasProfile).length,
      firstAlbum: activeUsers.filter((u) => usersWithVinyl.has(u.id)).length,
    };

    // ── A2/B3. 전환 지표 ─────────────────────────────────────
    const countType = (t: string) => periodEvents.filter((e) => e.EVENT_TYPE === t).length;
    const searches = countType('SEARCH');
    const adds = countType('ALBUM_ADD') + countType('WISH_ADD');
    const wishAdds = countType('WISH_ADD');
    const wishConverted = wishConvertRes.count || 0;
    const conversion = {
      searches,
      adds,
      searchToAdd: searches > 0 ? Math.round((adds / searches) * 100) : null,
      wishAdds,
      wishConverted,
      wishToOwned: wishAdds > 0 ? Math.round((wishConverted / wishAdds) * 100) : null,
    };

    // ── AI 스캔 사용량 (Gemini 파이프라인): 일별 성공/실패 + 성공률 + 오류 유형 ──
    const scanEvents = periodEvents.filter((e) => e.EVENT_TYPE === 'SCAN');
    const scanByDay = new Map<string, { success: number; fail: number }>();
    for (const e of scanEvents) {
      const d = toKstDate(e.CREATED_AT);
      const row = scanByDay.get(d) || { success: 0, fail: 0 };
      if (e.META?.result === 'success') row.success += 1;
      else row.fail += 1;
      scanByDay.set(d, row);
    }
    const scanSeries = dayKeys.map((date) => {
      const row = scanByDay.get(date) || { success: 0, fail: 0 };
      const total = row.success + row.fail;
      return {
        date,
        success: row.success,
        fail: row.fail,
        rate: total > 0 ? Math.round((row.success / total) * 100) : null,
      };
    });
    const scanTotal = scanEvents.length;
    const scanSuccess = scanEvents.filter((e) => e.META?.result === 'success').length;
    const failureLabel = (e: EventRow) =>
      e.META?.result === 'no_match'
        ? '후보 없음'
        : e.META?.status
          ? `HTTP ${e.META.status}`
          : '기타 오류';
    const scanFailures = scanEvents.filter((e) => e.META?.result !== 'success');
    const scanErrorTypes = new Map<string, number>();
    for (const e of scanFailures) {
      const label = failureLabel(e);
      scanErrorTypes.set(label, (scanErrorTypes.get(label) || 0) + 1);
    }
    const scanStats = {
      total: scanTotal,
      successRate: scanTotal > 0 ? Math.round((scanSuccess / scanTotal) * 100) : null,
      series: scanSeries,
      errorTypes: Array.from(scanErrorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
      recentFailures: scanFailures
        .sort((a, b) => b.CREATED_AT.localeCompare(a.CREATED_AT))
        .slice(0, 20)
        .map((e) => ({ at: e.CREATED_AT, label: failureLabel(e) })),
    };

    // ── 유입(Acquisition): 방문 → 가입 전환, 유입 소스, 가입 provider ──
    const visits = periodEvents.filter((e) => e.EVENT_TYPE === 'VISIT');
    const signupEvents = periodEvents.filter((e) => e.EVENT_TYPE === 'SIGNUP');
    const countBy = (rows: EventRow[], pick: (e: EventRow) => string) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = pick(r) || 'unknown';
        m.set(k, (m.get(k) || 0) + 1);
      }
      return Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, count]) => ({ label, count }));
    };
    const providerCount = new Map<string, number>();
    for (const u of activeUsers) providerCount.set(u.provider, (providerCount.get(u.provider) || 0) + 1);
    const acquisition = {
      visits: visits.length,
      signups: newInPeriod,
      visitToSignup: visits.length > 0 ? Math.round((newInPeriod / visits.length) * 100) : null,
      visitsBySource: countBy(visits, (e) => e.META?.source),
      signupsBySource: countBy(signupEvents, (e) => e.META?.source),
      signupsByProvider: Array.from(providerCount.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
      shareVisits: visits.filter((e) => e.META?.sharedFrom).length,
      shareSignups: signupEvents.filter((e) => e.META?.sharedFrom).length,
    };

    // ── A4. 플랫폼 자산 규모 ─────────────────────────────────
    const assetPurchaseTotal = ownedRows.reduce((sum, r) => sum + (r.PURCHASE_PRICE || 0), 0);

    // ── A3. 인기 앨범 / 아티스트 (보유+위시 관심도) ───────────
    const interestByAlbum = new Map<number, Set<string>>();
    for (const r of vinylRows) {
      if (!interestByAlbum.has(r.ALBUM_ID)) interestByAlbum.set(r.ALBUM_ID, new Set());
      interestByAlbum.get(r.ALBUM_ID)!.add(r.USER_ID);
    }
    const allAlbumIds = Array.from(interestByAlbum.keys());
    const masterById = new Map<number, { TITLE: string; ARTIST: string; IMAGE_URL: string; MARKET_PRICE: number | null }>();
    for (let i = 0; i < allAlbumIds.length; i += 500) {
      const chunk = allAlbumIds.slice(i, i + 500);
      const masters = await fetchAll<any>((from, to) =>
        admin
          .from('ALBUM_MASTER')
          .select('ALBUM_ID, TITLE, ARTIST, IMAGE_URL, MARKET_PRICE')
          .in('ALBUM_ID', chunk)
          .range(from, to)
      );
      for (const m of masters) masterById.set(m.ALBUM_ID, m);
    }
    const assetMarketTotal = ownedRows.reduce(
      (sum, r) => sum + (masterById.get(r.ALBUM_ID)?.MARKET_PRICE || 0),
      0
    );
    const topAlbums = Array.from(interestByAlbum.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 10)
      .map(([albumId, userSet]) => ({
        albumId,
        title: masterById.get(albumId)?.TITLE || '(알 수 없음)',
        artist: masterById.get(albumId)?.ARTIST || '',
        image: masterById.get(albumId)?.IMAGE_URL || '',
        users: userSet.size,
      }));
    const artistCount = new Map<string, number>();
    for (const r of vinylRows) {
      const artist = masterById.get(r.ALBUM_ID)?.ARTIST;
      if (artist) artistCount.set(artist, (artistCount.get(artist) || 0) + 1);
    }
    const topArtists = Array.from(artistCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([artist, count]) => ({ artist, count }));

    // ── 장르 분포 Top 10 ─────────────────────────────────────
    const ownedAlbumIds = Array.from(new Set(ownedRows.map((r) => r.ALBUM_ID)));
    const genreCount = new Map<string, number>();
    for (let i = 0; i < ownedAlbumIds.length; i += 500) {
      const chunk = ownedAlbumIds.slice(i, i + 500);
      const tags = await fetchAll<{ TAG_NAME: string }>((from, to) =>
        admin.from('VINYL_TAG').select('TAG_NAME').eq('TAG_TYPE', 'GENRE').in('ALBUM_ID', chunk).range(from, to)
      );
      for (const t of tags) genreCount.set(t.TAG_NAME, (genreCount.get(t.TAG_NAME) || 0) + 1);
    }
    const genreDist = Array.from(genreCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, count]) => ({ genre, count }));

    // ── 컬렉션 규모 분포 ─────────────────────────────────────
    const perUserOwned = new Map<string, number>();
    for (const r of ownedRows) perUserOwned.set(r.USER_ID, (perUserOwned.get(r.USER_ID) || 0) + 1);
    const buckets = [
      { bucket: '0장', min: 0, max: 0 },
      { bucket: '1-5장', min: 1, max: 5 },
      { bucket: '6-10장', min: 6, max: 10 },
      { bucket: '11-20장', min: 11, max: 20 },
      { bucket: '21-50장', min: 21, max: 50 },
      { bucket: '50장+', min: 51, max: Infinity },
    ];
    const bucketCounts = new Array(buckets.length).fill(0);
    bucketCounts[0] = Math.max(0, activeUsers.length - perUserOwned.size);
    for (const n of perUserOwned.values()) {
      const idx = buckets.findIndex((b) => n >= b.min && n <= b.max);
      if (idx >= 0) bucketCounts[idx] += 1;
    }
    const collectionHistogram = buckets.map((b, i) => ({ bucket: b.bucket, users: bucketCounts[i] }));

    return NextResponse.json({
      days,
      kpis: {
        totalUsers: activeUsers.length,
        deletedUsers: users.length - activeUsers.length,
        newUsers: newInPeriod,
        newUsersDelta: newInPeriod - newInPrevPeriod,
        ownedCount: ownedRows.length,
        wishCount: wishRows.length,
        openInquiries: openInquiriesRes.count || 0,
        dau,
        wau,
        mau,
        stickiness,
        dormantUsers,
        assetPurchaseTotal,
        assetMarketTotal,
      },
      funnel,
      conversion,
      acquisition,
      scanStats,
      signupTrend,
      dauTrend,
      heatmap,
      retentionCohorts,
      genreDist,
      collectionHistogram,
      topAlbums,
      topArtists,
    });
  } catch (e: any) {
    console.error('admin stats failed:', e?.message || e);
    return NextResponse.json({ error: 'stats aggregation failed' }, { status: 500 });
  }
}
