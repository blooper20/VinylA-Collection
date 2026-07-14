import { supabase } from './supabase';
import { AppError } from './errors';
import { ListeningLogWithAlbum } from './listeningLog';

// 스피닝 다이어리 소셜 — 좋아요/댓글(답글)/저장/신고.
// 접근 제어는 전부 RLS: 각 테이블 정책의 EXISTS 서브쿼리가 LISTENING_LOG의
// RLS(can_view_profile + IS_PUBLIC)를 타므로, 볼 수 없는 기록에는 상호작용
// 자체가 불가능하다. 여기서는 편의 함수만 제공한다.

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');
  return userId;
};

export interface SpinSocialSummary {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
}

/**
 * 여러 기록의 좋아요/댓글 수와 내 상태를 한 번에 — 목록 화면용.
 * 실패한 항목은 0으로 폴백 (소셜 카운트가 목록 렌더를 막으면 안 됨).
 */
export const getSpinSocialSummary = async (
  logIds: number[]
): Promise<Record<number, SpinSocialSummary>> => {
  const result: Record<number, SpinSocialSummary> = {};
  if (logIds.length === 0) return result;
  for (const id of logIds) {
    result[id] = { likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const myId = session?.user?.id;

  const [likes, comments, saves] = await Promise.all([
    supabase.from('SPIN_LOG_LIKE').select('LOG_ID, USER_ID').in('LOG_ID', logIds),
    supabase.from('SPIN_LOG_COMMENT').select('LOG_ID').in('LOG_ID', logIds),
    myId
      ? supabase.from('SPIN_LOG_SAVE').select('LOG_ID').eq('USER_ID', myId).in('LOG_ID', logIds)
      : Promise.resolve({ data: [] as { LOG_ID: number }[] }),
  ]);

  for (const row of (likes.data as { LOG_ID: number; USER_ID: string }[]) || []) {
    const s = result[row.LOG_ID];
    if (!s) continue;
    s.likeCount += 1;
    if (myId && row.USER_ID === myId) s.likedByMe = true;
  }
  for (const row of (comments.data as { LOG_ID: number }[]) || []) {
    if (result[row.LOG_ID]) result[row.LOG_ID].commentCount += 1;
  }
  for (const row of (saves.data as { LOG_ID: number }[]) || []) {
    if (result[row.LOG_ID]) result[row.LOG_ID].savedByMe = true;
  }
  return result;
};

export const likeSpinLog = async (logId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from('SPIN_LOG_LIKE').insert({ LOG_ID: logId, USER_ID: userId });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '좋아요에 실패했습니다.', error);
  }
};

export const unlikeSpinLog = async (logId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('SPIN_LOG_LIKE').delete().eq('LOG_ID', logId).eq('USER_ID', userId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '좋아요 취소에 실패했습니다.', error);
  }
};

export const saveSpinLog = async (logId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from('SPIN_LOG_SAVE').insert({ LOG_ID: logId, USER_ID: userId });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '저장에 실패했습니다.', error);
  }
};

export const unsaveSpinLog = async (logId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('SPIN_LOG_SAVE').delete().eq('LOG_ID', logId).eq('USER_ID', userId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '저장 해제에 실패했습니다.', error);
  }
};

export interface SavedSpinLog {
  SAVE_ID: number;
  SAVED_AT: string;
  /** 저장 시점 이후 기록이 비공개/차단되면 RLS가 null로 만든다 — 호출부에 오기 전에 걸러짐 */
  log: ListeningLogWithAlbum;
  OWNER_NAME: string | null;
}

/**
 * 내가 저장한 다이어리 기록 — SPIN_LOG_SAVE RLS가 본인 것만 반환한다.
 * 원본 기록이 더 이상 안 보이는 경우(작성자가 비공개 전환 후 언팔 등)는
 * 조인 결과가 null이라 목록에서 자동으로 빠진다.
 */
export const getMySavedSpinLogs = async (limit: number = 50): Promise<SavedSpinLog[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('SPIN_LOG_SAVE')
    .select('SAVE_ID, CREATED_AT, LISTENING_LOG(*, ALBUM_MASTER(*))')
    .eq('USER_ID', userId)
    .order('CREATED_AT', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const rows = (data as any[]).filter((r) => r.LISTENING_LOG);
  const ownerIds = [...new Set(rows.map((r) => r.LISTENING_LOG.USER_ID as string))];
  const nameMap: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('PROFILES').select('USER_ID, DISPLAY_NAME').in('USER_ID', ownerIds);
    for (const p of (profiles as { USER_ID: string; DISPLAY_NAME: string | null }[]) || []) {
      if (p.DISPLAY_NAME) nameMap[p.USER_ID] = p.DISPLAY_NAME;
    }
  }
  return rows.map((r) => ({
    SAVE_ID: r.SAVE_ID,
    SAVED_AT: r.CREATED_AT,
    log: r.LISTENING_LOG as ListeningLogWithAlbum,
    OWNER_NAME: nameMap[r.LISTENING_LOG.USER_ID] || null,
  }));
};

/** 신고 접수 — 같은 기록 중복 신고(23505)는 이미 접수된 것으로 성공 취급 */
export const reportSpinLog = async (logId: number, reason: string, details?: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('SPIN_LOG_REPORT')
    .insert({ LOG_ID: logId, REPORTER_ID: userId, REASON: reason.trim().slice(0, 300) || null, DETAILS: details?.trim() || null });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '신고 접수에 실패했습니다.', error);
  }
};

export const reportSpinComment = async (commentId: number, reason: string, details?: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('SPIN_COMMENT_REPORT')
    .insert({ COMMENT_ID: commentId, REPORTER_ID: userId, REASON: reason.trim().slice(0, 300) || null, DETAILS: details?.trim() || null });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '신고 접수에 실패했습니다.', error);
  }
};

export interface SpinComment {
  COMMENT_ID: number;
  LOG_ID: number;
  USER_ID: string;
  PARENT_COMMENT_ID: number | null;
  CONTENT: string;
  CREATED_AT: string;
  DISPLAY_NAME: string | null;
  IS_HIDDEN?: boolean;
  /** 이 댓글에 달린 답글들 (1단계 스레딩) */
  replies: SpinComment[];
}

export const getSpinLogComments = async (logId: number): Promise<SpinComment[]> => {
  const { data, error } = await supabase
    .from('SPIN_LOG_COMMENT')
    .select('*')
    .eq('LOG_ID', logId)
    .order('CREATED_AT', { ascending: true });
  if (error || !data) return [];

  const rows = data as any[];
  const ids = [...new Set(rows.map((r) => r.USER_ID as string))];
  const nameMap: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('PROFILES').select('USER_ID, DISPLAY_NAME').in('USER_ID', ids);
    for (const p of (profiles as { USER_ID: string; DISPLAY_NAME: string | null }[]) || []) {
      if (p.DISPLAY_NAME) nameMap[p.USER_ID] = p.DISPLAY_NAME;
    }
  }

  const byId: Record<number, SpinComment> = {};
  const top: SpinComment[] = [];
  for (const r of rows) {
    byId[r.COMMENT_ID] = { ...r, DISPLAY_NAME: nameMap[r.USER_ID] || null, replies: [] };
  }
  for (const r of rows) {
    const c = byId[r.COMMENT_ID];
    // 부모가 답글인 경우(깊은 스레드)도 그 부모의 최상위 스레드에 평탄화
    const parent = r.PARENT_COMMENT_ID ? byId[r.PARENT_COMMENT_ID] : null;
    if (parent) {
      const root = parent.PARENT_COMMENT_ID ? byId[parent.PARENT_COMMENT_ID] : parent;
      (root || parent).replies.push(c);
    } else {
      top.push(c);
    }
  }
  return top;
};

export const addSpinLogComment = async (
  logId: number,
  content: string,
  parentCommentId?: number
): Promise<void> => {
  const userId = await requireUserId();
  const trimmed = content.trim();
  if (!trimmed) throw new AppError('DB-001', '댓글 내용을 입력해주세요.');
  const { error } = await supabase.from('SPIN_LOG_COMMENT').insert({
    LOG_ID: logId,
    USER_ID: userId,
    PARENT_COMMENT_ID: parentCommentId ?? null,
    CONTENT: trimmed.slice(0, 500),
  });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '댓글 등록에 실패했습니다.', error);
  }
};

/** 삭제 권한(작성자 본인 또는 기록 주인)은 RLS가 판정 — 권한 없으면 0건 삭제 */
export const deleteSpinLogComment = async (commentId: number): Promise<void> => {
  const { error } = await supabase.from('SPIN_LOG_COMMENT').delete().eq('COMMENT_ID', commentId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '댓글 삭제에 실패했습니다.', error);
  }
};
