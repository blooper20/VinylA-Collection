import { supabase } from './supabase';
import { AppError } from './errors';
import { logEvent } from './events';
import { getProfilesLite } from './profile';

// 유저 팔로우 + 취향 매칭. USER_FOLLOW는 public read / 본인(FOLLOWER_ID)만
// 쓰기 — 컬렉션·프로필이 이미 전체 공개라 팔로우 관계 공개도 새 노출이
// 아니다. 매칭 집계는 클라이언트에서 전체 USER_VINYL을 긁지 않고
// get_taste_matches RPC(DB 집계)로 처리한다.

export interface TasteMatch {
  USER_ID: string;
  DISPLAY_NAME: string | null;
  PROFILE_IMAGE_URL: string | null;
  /** 나와 겹치는 OWNED 앨범 수 */
  OVERLAP_COUNT: number;
  /** 상대의 전체 OWNED 앨범 수 */
  THEIR_COUNT: number;
  /** 겹침 ÷ min(내 수집 수, 상대 수집 수) × 100 */
  MATCH_PERCENT: number;
}

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');
  return userId;
};

export const followUser = async (targetUserId: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('USER_FOLLOW')
    .insert({ FOLLOWER_ID: userId, FOLLOWING_ID: targetUserId });
  // 23505(이미 팔로우 중)는 성공으로 취급 — 버튼 연타/탭 간 경합에서 안전
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '팔로우에 실패했습니다.', error);
  }
  logEvent('FOLLOW', { targetUserId });
};

export const unfollowUser = async (targetUserId: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('USER_FOLLOW')
    .delete()
    .eq('FOLLOWER_ID', userId)
    .eq('FOLLOWING_ID', targetUserId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '언팔로우에 실패했습니다.', error);
  }
};

/** 내가 팔로우하는 유저 id 집합 — 팔로우 버튼 상태 표시용 */
export const getMyFollowingIds = async (): Promise<Set<string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('USER_FOLLOW')
    .select('FOLLOWING_ID')
    .eq('FOLLOWER_ID', userId);
  if (error) return new Set();
  return new Set(((data as { FOLLOWING_ID: string }[]) || []).map((r) => r.FOLLOWING_ID));
};

export interface FollowListEntry {
  USER_ID: string;
  DISPLAY_NAME: string | null;
  FOLLOWED_AT: string;
}

/**
 * 팔로워/팔로잉 목록 (최신순 100명). 접근 제어는 get_follow_list RPC 안에서 —
 * 본인/관리자/공개 프로필만 행을 받고, 비공개 프로필의 목록은 빈 배열.
 */
export const getFollowList = async (
  userId: string,
  type: 'followers' | 'following'
): Promise<FollowListEntry[]> => {
  const { data, error } = await supabase.rpc('get_follow_list', {
    p_user: userId,
    p_type: type,
    p_limit: 100,
  });
  if (error || !data) return [];
  return ((data as any[]) || []).map((r) => ({
    USER_ID: r.user_id,
    DISPLAY_NAME: r.display_name || null,
    FOLLOWED_AT: r.followed_at,
  }));
};

/**
 * 팔로워/팔로잉 카운트 — 비공개 프로필 포함 누구나 볼 수 있다
 * (get_follow_counts RPC가 집계 숫자만 반환).
 */
export const getFollowCounts = async (
  userId: string
): Promise<{ followers: number; following: number }> => {
  const { data, error } = await supabase.rpc('get_follow_counts', { p_user: userId });
  if (error || !data) return { followers: 0, following: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  return { followers: Number(row?.followers || 0), following: Number(row?.following || 0) };
};

// ── 팔로우 요청 (비공개 프로필 대상) ──────────────────────────

export interface FollowRequestEntry {
  USER_ID: string;
  DISPLAY_NAME: string | null;
  REQUESTED_AT: string;
}

/** 비공개 프로필에 팔로우 요청 — 대상이 수락해야 팔로우가 된다 */
export const requestFollow = async (targetUserId: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('FOLLOW_REQUEST')
    .insert({ REQUESTER_ID: userId, TARGET_ID: targetUserId });
  // 23505(이미 요청됨)는 성공 취급
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '팔로우 요청에 실패했습니다.', error);
  }
};

/** 내가 보낸 요청 취소 */
export const cancelFollowRequest = async (targetUserId: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('FOLLOW_REQUEST')
    .delete()
    .eq('REQUESTER_ID', userId)
    .eq('TARGET_ID', targetUserId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '요청 취소에 실패했습니다.', error);
  }
};

/** 내가 보낸(아직 수락 안 된) 요청의 대상 id 집합 — "요청됨" 버튼 상태용 */
export const getMyOutgoingRequestIds = async (): Promise<Set<string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return new Set();
  const { data, error } = await supabase
    .from('FOLLOW_REQUEST')
    .select('TARGET_ID')
    .eq('REQUESTER_ID', userId);
  if (error) return new Set();
  return new Set(((data as { TARGET_ID: string }[]) || []).map((r) => r.TARGET_ID));
};

/** 나에게 들어온 팔로우 요청 목록 (수락/거절 UI용) */
export const getIncomingFollowRequests = async (): Promise<FollowRequestEntry[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('FOLLOW_REQUEST')
    .select('REQUESTER_ID, CREATED_AT')
    .eq('TARGET_ID', userId)
    .order('CREATED_AT', { ascending: false });
  if (error || !data) return [];

  const rows = data as { REQUESTER_ID: string; CREATED_AT: string }[];
  const nameMap: Record<string, string> = {};
  if (rows.length > 0) {
    const { data: profiles } = await supabase
      .from('PROFILES')
      .select('USER_ID, DISPLAY_NAME')
      .in('USER_ID', rows.map((r) => r.REQUESTER_ID));
    for (const p of (profiles as { USER_ID: string; DISPLAY_NAME: string | null }[]) || []) {
      if (p.DISPLAY_NAME) nameMap[p.USER_ID] = p.DISPLAY_NAME;
    }
  }
  return rows.map((r) => ({
    USER_ID: r.REQUESTER_ID,
    DISPLAY_NAME: nameMap[r.REQUESTER_ID] || null,
    REQUESTED_AT: r.CREATED_AT,
  }));
};

/** 팔로우 요청 수락 (대상자 본인만) — RPC가 팔로우 생성 + 요청 삭제를 처리 */
export const acceptFollowRequest = async (requesterId: string): Promise<void> => {
  const { error } = await supabase.rpc('accept_follow_request', { p_requester: requesterId });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '요청 수락에 실패했습니다.', error);
  }
  logEvent('FOLLOW', { acceptedFrom: requesterId });
};

/** 팔로우 요청 거절 (대상자 본인만) */
export const rejectFollowRequest = async (requesterId: string): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');
  const { error } = await supabase
    .from('FOLLOW_REQUEST')
    .delete()
    .eq('REQUESTER_ID', requesterId)
    .eq('TARGET_ID', userId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '요청 거절에 실패했습니다.', error);
  }
};

/**
 * 나와 취향(OWNED 앨범)이 겹치는 수집가 추천 — 겹침 많은 순.
 * 비로그인/수집 0장/집계 실패 시 조용히 빈 배열 (피드 페이지가 레일을 숨김).
 */
export const getTasteMatches = async (limit: number = 10): Promise<TasteMatch[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_taste_matches', {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    console.warn('getTasteMatches failed:', error.message);
    return [];
  }
  const rows = (data as any[]) || [];
  // RPC는 닉네임만 반환하므로 프로필 사진은 별도 맵으로 붙인다
  const profileMap = await getProfilesLite(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    USER_ID: r.user_id,
    DISPLAY_NAME: r.display_name || null,
    PROFILE_IMAGE_URL: profileMap[r.user_id]?.img || null,
    OVERLAP_COUNT: Number(r.overlap_count),
    THEIR_COUNT: Number(r.their_count),
    MATCH_PERCENT: Number(r.match_percent),
  }));
};
