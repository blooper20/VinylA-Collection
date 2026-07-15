import { supabase } from './supabase';
import { ALBUM_MASTER } from '@vinyla/shared-types';
import { AppError } from './errors';
import { getProfilesLite } from './profile';

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
