import { supabase } from './supabase';
import { NOTICE, NoticeMediaItem } from '@vinyla/shared-types';
import { AppError } from './errors';
import { getProxyBaseUrl } from './externalApi';
import { getProfilesLite } from './profile';

// 공지사항 — 관리자만 작성/수정/삭제(서버 라우트 + service role). 댓글은
// 공지별로 관리자가 열고 닫을 수 있다(IS_COMMENTS_ENABLED) — 꺼져 있으면
// RLS가 새 댓글 INSERT 자체를 거부해 UI 숨김과 별개로 서버에서도 강제된다.
// 조회는 NOTICE/NOTICE_COMMENT/NOTICE_COMMENT_LIKE 전부 public read라
// 로그인 여부와 무관하게 누구나 볼 수 있다. 쓰기는 전부 /api/admin/notices
// 서버 라우트를 거친다 — 클라이언트에는 NOTICE INSERT/UPDATE/DELETE 정책
// 자체가 없다(VINYL_STORY와 동일 패턴). 댓글/좋아요는 본인 것만 RLS로 직접 쓴다.

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-001', '로그인이 필요합니다.');
  return { Authorization: `Bearer ${session.access_token}` };
};

const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');
  return userId;
};

/** 상단 고정 공지 — 최대 5개, 최근 고정한 순. 목록 화면 최상단에 항상 노출. */
export const getPinnedNotices = async (): Promise<NOTICE[]> => {
  const { data, error } = await supabase
    .from('NOTICE')
    .select('*')
    .eq('IS_PINNED', true)
    .order('PINNED_AT', { ascending: false });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '공지사항을 불러오는 데 실패했습니다.', error);
  }
  return (data as NOTICE[]) || [];
};

/** 일반(비고정) 공지 목록 — 최신순, beforeCreatedAt으로 커서 페이지네이션. */
export const getNotices = async (
  { limit = 20, beforeCreatedAt }: { limit?: number; beforeCreatedAt?: string } = {}
): Promise<NOTICE[]> => {
  let query = supabase
    .from('NOTICE')
    .select('*')
    .eq('IS_PINNED', false)
    .order('CREATED_AT', { ascending: false })
    .limit(limit);
  if (beforeCreatedAt) query = query.lt('CREATED_AT', beforeCreatedAt);

  const { data, error } = await query;
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '공지사항을 불러오는 데 실패했습니다.', error);
  }
  return (data as NOTICE[]) || [];
};

export const getNotice = async (noticeId: number): Promise<NOTICE | null> => {
  const { data, error } = await supabase
    .from('NOTICE')
    .select('*')
    .eq('NOTICE_ID', noticeId)
    .maybeSingle();
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '공지사항을 불러오는 데 실패했습니다.', error);
  }
  return (data as NOTICE) || null;
};

const guessExtension = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/jpeg': 'jpg',
    'video/quicktime': 'mov', 'video/mp4': 'mp4',
  };
  return map[mimeType] || (mimeType.startsWith('video/') ? 'mp4' : 'jpg');
};

/** 공지 첨부 미디어 업로드(이미지/영상 여러 건, 한 파일씩 호출). 관리자 전용 서버 라우트. */
export const uploadNoticeMedia = async (file: Blob & { name?: string }): Promise<NoticeMediaItem> => {
  const headers = await authHeaders();
  const form = new FormData();
  const filename = (file as File).name || `media.${guessExtension(file.type)}`;
  form.append('file', file, filename);
  const res = await fetch(`${getProxyBaseUrl()}/api/admin/notices/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '미디어 업로드에 실패했습니다.');
  }
  return (await res.json()) as NoticeMediaItem;
};

export interface NoticeInput {
  title: string;
  content: string;
  mediaItems: NoticeMediaItem[];
  isPinned: boolean;
  isCommentsEnabled: boolean;
}

export const createNotice = async (input: NoticeInput): Promise<NOTICE> => {
  const headers = await authHeaders();
  const res = await fetch(`${getProxyBaseUrl()}/api/admin/notices`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '공지 작성에 실패했습니다.');
  }
  return (await res.json()).notice as NOTICE;
};

export const updateNotice = async (noticeId: number, input: NoticeInput): Promise<NOTICE> => {
  const headers = await authHeaders();
  const res = await fetch(`${getProxyBaseUrl()}/api/admin/notices/${noticeId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '공지 수정에 실패했습니다.');
  }
  return (await res.json()).notice as NOTICE;
};

export const deleteNotice = async (noticeId: number): Promise<void> => {
  const headers = await authHeaders();
  const res = await fetch(`${getProxyBaseUrl()}/api/admin/notices/${noticeId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '공지 삭제에 실패했습니다.');
  }
};

/** 관리자 목록 화면용 — 고정 여부와 무관하게 전체를 최신순으로. */
export const getAllNoticesForAdmin = async (): Promise<NOTICE[]> => {
  const { data, error } = await supabase
    .from('NOTICE')
    .select('*')
    .order('IS_PINNED', { ascending: false })
    .order('CREATED_AT', { ascending: false });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '공지사항을 불러오는 데 실패했습니다.', error);
  }
  return (data as NOTICE[]) || [];
};

// ── 공지 댓글 + 댓글 좋아요 ──────────────────────────────────────────

export interface NoticeComment {
  COMMENT_ID: number;
  NOTICE_ID: number;
  USER_ID: string;
  CONTENT: string;
  CREATED_AT: string;
  DISPLAY_NAME: string | null;
  PROFILE_IMAGE_URL: string | null;
  LIKE_COUNT: number;
  LIKED_BY_ME: boolean;
}

export const getNoticeComments = async (noticeId: number): Promise<NoticeComment[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const myId = session?.user?.id;

  const { data, error } = await supabase
    .from('NOTICE_COMMENT')
    .select('*')
    .eq('NOTICE_ID', noticeId)
    .order('CREATED_AT', { ascending: true });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '댓글을 불러오는 데 실패했습니다.', error);
  }
  const rows = (data as any[]) || [];
  if (rows.length === 0) return [];

  const commentIds = rows.map((r) => r.COMMENT_ID);
  const [profileMap, likesRes] = await Promise.all([
    getProfilesLite(rows.map((r) => r.USER_ID)),
    supabase.from('NOTICE_COMMENT_LIKE').select('COMMENT_ID, USER_ID').in('COMMENT_ID', commentIds),
  ]);

  const likeCountMap: Record<number, number> = {};
  const likedByMeSet = new Set<number>();
  for (const l of (likesRes.data as { COMMENT_ID: number; USER_ID: string }[]) || []) {
    likeCountMap[l.COMMENT_ID] = (likeCountMap[l.COMMENT_ID] || 0) + 1;
    if (myId && l.USER_ID === myId) likedByMeSet.add(l.COMMENT_ID);
  }

  return rows.map((r) => ({
    ...r,
    DISPLAY_NAME: profileMap[r.USER_ID]?.name || null,
    PROFILE_IMAGE_URL: profileMap[r.USER_ID]?.img || null,
    LIKE_COUNT: likeCountMap[r.COMMENT_ID] || 0,
    LIKED_BY_ME: likedByMeSet.has(r.COMMENT_ID),
  }));
};

export const addNoticeComment = async (noticeId: number, content: string): Promise<void> => {
  const userId = await requireUserId();
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase
    .from('NOTICE_COMMENT')
    .insert({ NOTICE_ID: noticeId, USER_ID: userId, CONTENT: trimmed.slice(0, 500) });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '댓글 작성에 실패했습니다.', error);
  }
};

/** 작성자 본인 또는 관리자만 — RLS가 실제 판정을 담당(여기선 그냥 시도) */
export const deleteNoticeComment = async (commentId: number): Promise<void> => {
  const { error } = await supabase.from('NOTICE_COMMENT').delete().eq('COMMENT_ID', commentId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '댓글 삭제에 실패했습니다.', error);
  }
};

export const likeNoticeComment = async (commentId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from('NOTICE_COMMENT_LIKE').insert({ COMMENT_ID: commentId, USER_ID: userId });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '좋아요 처리에 실패했습니다.', error);
  }
};

export const unlikeNoticeComment = async (commentId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from('NOTICE_COMMENT_LIKE').delete().eq('COMMENT_ID', commentId).eq('USER_ID', userId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '좋아요 취소에 실패했습니다.', error);
  }
};
