import { supabase } from './supabase';
import { ALBUM_MASTER, CommunityPostCategory } from '@vinyla/shared-types';
import { AppError } from './errors';
import { getProfilesLite } from './profile';
import { getCommunityPosts, getCommunityPost, CommunityPostWithMeta } from './communityBoard';
import { getDiscoveryListeningLog, ListeningLogWithAlbum } from './listeningLog';
import { getSpinSocialSummary, SpinSocialSummary } from './spinSocial';

// 디스커버리 피드 — "방금 다른 수집가가 어떤 LP를 보관함에 담았는지"를
// 보여준다. USER_VINYL은 public read + Realtime publication에 이미 등록돼
// 있어 새 테이블 없이 조회/구독만 얹는다. 구매 가격(PURCHASE_PRICE)은
// 민감 정보라 피드에 노출하지 않는다.

/**
 * 피드 에포크 — 이 시각(피드 기능 출시, 2026-07-14 18:00 KST) 이전에 담긴
 * 수집 기록은 피드에 노출하지 않는다. 기능 출시 전 데이터는 "피드에 공개될
 * 것"을 전제로 만들어진 게 아니기 때문. 컬렉션 자체의 열람은 프로필 공개
 * opt-in(유저 동의)이 별도로 통제한다.
 */
export const FEED_EPOCH = '2026-07-14T09:00:00Z';

export type FeedAlbum = Pick<
  ALBUM_MASTER,
  'ALBUM_ID' | 'TITLE' | 'ARTIST' | 'IMAGE_URL' | 'RELEASE_YEAR'
>;

export interface FeedItem {
  USER_VINYL_ID: number;
  USER_ID: string;
  ALBUM_ID: number;
  ADDED_AT: string;
  STATUS: 'OWNED' | 'WISH' | 'NONE';
  IS_PUBLIC: boolean;
  ALBUM: FeedAlbum | null;
  /** PROFILES.DISPLAY_NAME — 닉네임 미설정 유저는 null (UI에서 익명 표기) */
  DISPLAY_NAME: string | null;
  /** PROFILES.PROFILE_IMAGE_URL — 프로필 사진 없는 유저는 null */
  PROFILE_IMAGE_URL: string | null;
}

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

/**
 * 최근 수집(OWNED) 피드 — ADDED_AT 내림차순. beforeAddedAt을 넘기면 그보다
 * 오래된 페이지를 이어서 가져온다(커서 페이지네이션).
 * 참고: 위시 → 보유 전환은 UPDATE라 ADDED_AT(최초 담은 시각)이 유지된다 —
 * 전환 건은 피드 상단에 다시 떠오르지 않는 알려진 한계(v1 허용).
 */
export const getDiscoveryFeed = async (
  { limit = 30, beforeAddedAt }: { limit?: number; beforeAddedAt?: string } = {}
): Promise<FeedItem[]> => {
  let query = supabase
    .from('USER_VINYL')
    .select('USER_VINYL_ID, USER_ID, ALBUM_ID, ADDED_AT, STATUS, IS_PUBLIC, ALBUM_MASTER(ALBUM_ID, TITLE, ARTIST, IMAGE_URL, RELEASE_YEAR)')
    .in('STATUS', ['OWNED', 'WISH'])
    .eq('IS_PUBLIC', true)
    .gte('ADDED_AT', FEED_EPOCH)
    .order('ADDED_AT', { ascending: false })
    .limit(limit);
  if (beforeAddedAt) query = query.lt('ADDED_AT', beforeAddedAt);

  const { data, error } = await query;
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '피드를 불러오는 데 실패했습니다.', error);
  }

  const rows = (data as any[]) || [];
  const profileMap = await getProfilesLite(rows.map((r) => r.USER_ID));
  return rows.map((r) => ({
    USER_VINYL_ID: r.USER_VINYL_ID,
    USER_ID: r.USER_ID,
    ALBUM_ID: r.ALBUM_ID,
    ADDED_AT: r.ADDED_AT,
    STATUS: r.STATUS,
    IS_PUBLIC: r.IS_PUBLIC,
    ALBUM: (r.ALBUM_MASTER as FeedAlbum) || null,
    DISPLAY_NAME: profileMap[r.USER_ID]?.name || null,
    PROFILE_IMAGE_URL: profileMap[r.USER_ID]?.img || null,
  }));
};

/**
 * 실시간 구독 — 새 수집(INSERT with OWNED, 또는 WISH→OWNED UPDATE)이 생기면
 * 앨범/닉네임을 채워 콜백으로 넘긴다. 반환값은 해제 함수. 중복(같은
 * USER_VINYL_ID)은 호출부에서 걸러야 한다.
 */
export const subscribeToDiscoveryFeed = (onItem: (item: FeedItem) => void): (() => void) => {
  const enrich = async (row: any) => {
    if (!row || !['OWNED', 'WISH'].includes(row.STATUS) || row.IS_PUBLIC === false) return;
    // 에포크 이전에 담긴 행(위시→보유 전환 UPDATE 등)은 피드에 올리지 않는다
    if (row.ADDED_AT && row.ADDED_AT < FEED_EPOCH) return;
    const [{ data: album }, profileMap] = await Promise.all([
      supabase
        .from('ALBUM_MASTER')
        .select('ALBUM_ID, TITLE, ARTIST, IMAGE_URL, RELEASE_YEAR')
        .eq('ALBUM_ID', row.ALBUM_ID)
        .maybeSingle(),
      getProfilesLite([row.USER_ID]),
    ]);
    onItem({
      USER_VINYL_ID: row.USER_VINYL_ID,
      USER_ID: row.USER_ID,
      ALBUM_ID: row.ALBUM_ID,
      ADDED_AT: row.ADDED_AT || new Date().toISOString(),
      STATUS: row.STATUS,
      IS_PUBLIC: row.IS_PUBLIC !== false,
      ALBUM: (album as FeedAlbum) || null,
      DISPLAY_NAME: profileMap[row.USER_ID]?.name || null,
      PROFILE_IMAGE_URL: profileMap[row.USER_ID]?.img || null,
    });
  };

  const channel = supabase
    .channel('discovery-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'USER_VINYL' },
      (payload) => { void enrich(payload.new); }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'USER_VINYL' },
      (payload) => {
        // 위시 → 보유 전환만 새 소식으로 취급 (커버 교체 등 단순 수정 제외)
        const oldStatus = (payload.old as any)?.STATUS;
        if (oldStatus !== 'OWNED') void enrich(payload.new);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

// ── 자랑게시판 게시글을 섞은 통합 피드 ─────────────────────────────────
// "소셜" 피드는 원래 수집 활동(위)만 보여줬지만, 사진 위주인 커뮤니티
// "자랑" 탭(CommunityTabs.tsx의 SHOWCASE 카테고리)의 글도 인스타그램처럼
// 같은 타임라인에 자연스럽게 섞어 보여준다. 두 카테고리 그룹이 어긋나면
// 피드에서 조용히 빠지는 글이 생기니, CommunityTabs.tsx의 SHOWCASE 탭
// 정의를 바꾸면 이 배열도 같이 바꿔야 한다.
const SHOWCASE_CATEGORIES: CommunityPostCategory[] = ['ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST', 'ONOCHU'];

export interface ListeningLogFeedItem extends ListeningLogWithAlbum {
  PROFILE_IMAGE_URL: string | null;
  SOCIAL: SpinSocialSummary;
}

const EMPTY_SOCIAL: SpinSocialSummary = { likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false };

const enrichListeningLogs = async (rows: ListeningLogWithAlbum[]): Promise<ListeningLogFeedItem[]> => {
  if (rows.length === 0) return [];
  const [profileMap, socialMap] = await Promise.all([
    getProfilesLite(rows.map((r) => r.USER_ID)),
    getSpinSocialSummary(rows.map((r) => r.LOG_ID)),
  ]);
  return rows.map((r) => ({
    ...r,
    DISPLAY_NAME: profileMap[r.USER_ID]?.name || null,
    PROFILE_IMAGE_URL: profileMap[r.USER_ID]?.img || null,
    SOCIAL: socialMap[r.LOG_ID] || EMPTY_SOCIAL,
  }));
};

export type FeedEntry =
  | { KIND: 'VINYL_ADD'; SORT_AT: string; DATA: FeedItem }
  | { KIND: 'SHOWCASE_POST'; SORT_AT: string; DATA: CommunityPostWithMeta }
  | { KIND: 'LISTENING_LOG'; SORT_AT: string; DATA: ListeningLogFeedItem };

const sortEntriesDesc = (entries: FeedEntry[]): FeedEntry[] =>
  [...entries].sort((a, b) => (a.SORT_AT < b.SORT_AT ? 1 : a.SORT_AT > b.SORT_AT ? -1 : 0));

export interface MergedFeedPage {
  entries: FeedEntry[];
  /** 다음 페이지 요청 시 그대로 넘기면 되는 커서 — 세 소스를 독립적으로 페이지네이션한다 */
  nextVinylCursor: string | null;
  nextPostCursor: string | null;
  nextLogCursor: string | null;
  hasMore: boolean;
}

/**
 * 수집 활동 + 자랑게시판 글 + 다이어리(재생 기록)를 하나의 타임라인으로
 * 합친다. 세 테이블을 각자의 커서로 최대 limit개씩 가져와 시간순으로
 * 병합하는데, 잘라내지 않고 가져온 건 전부 반환한다(어느 한쪽이 몰리면
 * 페이지가 최대 3*limit까지 커질 수 있음) — 이렇게 해야 커서가 항상
 * "이번에 실제로 받은 마지막 항목"을 정확히 가리켜서 다음 페이지 호출 때
 * 데이터가 누락되지 않는다. 대신 세 소스의 병합 지점(다음 페이지 경계)에서는
 * 아주 드물게 시간 순서가 살짝 어긋날 수 있다(v1 허용, 각 소스 내부 정렬은
 * 항상 정확함).
 */
export const getMergedFeed = async (
  { limit = 30, beforeVinylAt, beforePostAt, beforeLogAt }: {
    limit?: number; beforeVinylAt?: string; beforePostAt?: string; beforeLogAt?: string;
  } = {}
): Promise<MergedFeedPage> => {
  const [vinylItems, posts, logRows] = await Promise.all([
    getDiscoveryFeed({ limit, beforeAddedAt: beforeVinylAt }).catch(() => [] as FeedItem[]),
    getCommunityPosts({ category: SHOWCASE_CATEGORIES, limit, beforeCreatedAt: beforePostAt }).catch(
      () => [] as CommunityPostWithMeta[]
    ),
    getDiscoveryListeningLog({ limit, beforeCreatedAt: beforeLogAt }).catch(() => [] as ListeningLogWithAlbum[]),
  ]);
  const logs = await enrichListeningLogs(logRows).catch(() => [] as ListeningLogFeedItem[]);

  const entries = sortEntriesDesc([
    ...vinylItems.map((v) => ({ KIND: 'VINYL_ADD' as const, SORT_AT: v.ADDED_AT, DATA: v })),
    ...posts.map((p) => ({ KIND: 'SHOWCASE_POST' as const, SORT_AT: p.CREATED_AT, DATA: p })),
    ...logs.map((l) => ({ KIND: 'LISTENING_LOG' as const, SORT_AT: l.CREATED_AT, DATA: l })),
  ]);

  return {
    entries,
    nextVinylCursor: vinylItems.length > 0 ? vinylItems[vinylItems.length - 1].ADDED_AT : beforeVinylAt ?? null,
    nextPostCursor: posts.length > 0 ? posts[posts.length - 1].CREATED_AT : beforePostAt ?? null,
    nextLogCursor: logRows.length > 0 ? logRows[logRows.length - 1].CREATED_AT : beforeLogAt ?? null,
    hasMore: vinylItems.length === limit || posts.length === limit || logRows.length === limit,
  };
};

/** 새 자랑게시판 글이 올라오면 작성자/좋아요·댓글수까지 채워서 콜백으로 넘긴다. */
const subscribeToShowcasePosts = (onItem: (post: CommunityPostWithMeta) => void): (() => void) => {
  const channel = supabase
    .channel('discovery-feed-showcase')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'COMMUNITY_POST' },
      (payload) => {
        const row = payload.new as any;
        if (!row || !SHOWCASE_CATEGORIES.includes(row.CATEGORY)) return;
        void getCommunityPost(row.POST_ID).then((post) => {
          if (post) onItem(post);
        });
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

/** 새 공개 다이어리 기록이 올라오면 작성자 정보를 채워서(좋아요·댓글은 0) 콜백으로 넘긴다. */
const subscribeToDiscoveryListeningLog = (onItem: (entry: ListeningLogFeedItem) => void): (() => void) => {
  const channel = supabase
    .channel('discovery-feed-listening-log')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'LISTENING_LOG' },
      (payload) => {
        const row = payload.new as any;
        if (!row || row.IS_PUBLIC === false) return;
        void (async () => {
          const [{ data: album }, profileMap] = await Promise.all([
            supabase.from('ALBUM_MASTER').select('*').eq('ALBUM_ID', row.ALBUM_ID).maybeSingle(),
            getProfilesLite([row.USER_ID]),
          ]);
          onItem({
            ...(row as ListeningLogWithAlbum),
            ALBUM_MASTER: (album as ALBUM_MASTER) || null,
            DISPLAY_NAME: profileMap[row.USER_ID]?.name || null,
            PROFILE_IMAGE_URL: profileMap[row.USER_ID]?.img || null,
            SOCIAL: EMPTY_SOCIAL,
          });
        })();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
};

/** getMergedFeed의 실시간 버전 — 수집 활동·자랑게시판 글·다이어리 구독을 하나로 묶는다. */
export const subscribeToMergedFeed = (onEntry: (entry: FeedEntry) => void): (() => void) => {
  const unsubVinyl = subscribeToDiscoveryFeed((item) =>
    onEntry({ KIND: 'VINYL_ADD', SORT_AT: item.ADDED_AT, DATA: item })
  );
  const unsubPosts = subscribeToShowcasePosts((post) =>
    onEntry({ KIND: 'SHOWCASE_POST', SORT_AT: post.CREATED_AT, DATA: post })
  );
  const unsubLogs = subscribeToDiscoveryListeningLog((entry) =>
    onEntry({ KIND: 'LISTENING_LOG', SORT_AT: entry.CREATED_AT, DATA: entry })
  );
  return () => {
    unsubVinyl();
    unsubPosts();
    unsubLogs();
  };
};
