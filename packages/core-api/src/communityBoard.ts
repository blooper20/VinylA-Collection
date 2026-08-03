import { supabase } from './supabase';
import { AppError } from './errors';
import { getProxyBaseUrl } from './externalApi';
import { getProfilesLite } from './profile';
import type { RNFilePart } from './listeningLog';
import { COMMUNITY_POST, COMMUNITY_COMMENT, CommunityMediaItem, CommunityPostCategory } from '@vinyla/shared-types';

// 커뮤니티 게시판 — 6개 카테고리(오늘 온 전리품/자유/QnA/정보/나만의 청음실/팁)를
// COMMUNITY_POST 한 테이블로 다루고 CATEGORY로 구분한다. 항상 전체 공개(RLS가
// public read)라 로그인 여부와 무관하게 목록/상세를 볼 수 있다. 쓰기(작성/삭제/
// 댓글/좋아요/신고/채택)는 전부 본인 것만 RLS로 직접 처리 — notice.ts와 달리
// 관리자 전용 서버 라우트가 없다(유저 생성 콘텐츠이므로).

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

const requireUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');
  return userId;
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-001', '로그인이 필요합니다.');
  return { Authorization: `Bearer ${session.access_token}` };
};

export interface CommunityPostAlbum {
  ALBUM_ID: number;
  TITLE: string;
  ARTIST: string;
  IMAGE_URL: string | null;
}

export interface CommunityPostWithMeta extends COMMUNITY_POST {
  AUTHOR_NAME: string | null;
  AUTHOR_IMAGE: string | null;
  COMMENT_COUNT: number;
  /** 오늘 온 전리품 전용 — 첨부된 본인 컬렉션 앨범들 */
  albums: CommunityPostAlbum[];
}

const attachMeta = async (rows: any[]): Promise<CommunityPostWithMeta[]> => {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.POST_ID);
  const [profileMap, commentsRes, albumsRes] = await Promise.all([
    getProfilesLite(rows.map((r) => r.AUTHOR_ID)),
    supabase.from('COMMUNITY_COMMENT').select('POST_ID').in('POST_ID', postIds),
    supabase.from('COMMUNITY_POST_ALBUM').select('POST_ID, ALBUM_ID, ALBUM_MASTER(TITLE, ARTIST, IMAGE_URL)').in('POST_ID', postIds),
  ]);

  const commentCountMap: Record<number, number> = {};
  for (const c of (commentsRes.data as { POST_ID: number }[]) || []) {
    commentCountMap[c.POST_ID] = (commentCountMap[c.POST_ID] || 0) + 1;
  }
  const albumsMap: Record<number, CommunityPostAlbum[]> = {};
  for (const a of (albumsRes.data as any[]) || []) {
    const list = albumsMap[a.POST_ID] || (albumsMap[a.POST_ID] = []);
    list.push({
      ALBUM_ID: a.ALBUM_ID,
      TITLE: a.ALBUM_MASTER?.TITLE || '',
      ARTIST: a.ALBUM_MASTER?.ARTIST || '',
      IMAGE_URL: a.ALBUM_MASTER?.IMAGE_URL || null,
    });
  }

  return rows.map((r) => ({
    ...r,
    AUTHOR_NAME: profileMap[r.AUTHOR_ID]?.name || null,
    AUTHOR_IMAGE: profileMap[r.AUTHOR_ID]?.img || null,
    COMMENT_COUNT: commentCountMap[r.POST_ID] || 0,
    albums: albumsMap[r.POST_ID] || [],
  }));
};

/**
 * 카테고리별(또는 전체) 게시글 목록 — 최신순, beforeCreatedAt 커서 페이지네이션.
 * category에 배열을 넘기면 여러 카테고리를 하나의 탭으로 묶어 조회한다
 * (예: 커뮤니티 상단 "자랑" 탭 = ARRIVAL + LISTENING_ROOM).
 */
export const getCommunityPosts = async (
  { category, limit = 20, beforeCreatedAt }: { category?: CommunityPostCategory | CommunityPostCategory[]; limit?: number; beforeCreatedAt?: string } = {}
): Promise<CommunityPostWithMeta[]> => {
  let query = supabase
    .from('COMMUNITY_POST')
    .select('*')
    .order('CREATED_AT', { ascending: false })
    .limit(limit);
  if (Array.isArray(category)) {
    if (category.length > 0) query = query.in('CATEGORY', category);
  } else if (category) {
    query = query.eq('CATEGORY', category);
  }
  if (beforeCreatedAt) query = query.lt('CREATED_AT', beforeCreatedAt);

  const { data, error } = await query;
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '게시글을 불러오는 데 실패했습니다.', error);
  }
  return attachMeta((data as any[]) || []);
};

export const getCommunityPost = async (postId: number): Promise<CommunityPostWithMeta | null> => {
  const { data, error } = await supabase
    .from('COMMUNITY_POST')
    .select('*')
    .eq('POST_ID', postId)
    .maybeSingle();
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '게시글을 불러오는 데 실패했습니다.', error);
  }
  if (!data) return null;
  const [withMeta] = await attachMeta([data]);
  return withMeta;
};

export const incrementCommunityPostViewCount = async (postId: number): Promise<void> => {
  try {
    await supabase.rpc('increment_community_post_view_count', { p_post_id: postId });
  } catch {
    // 조회수 기록 실패는 무시 — 화면 표시에는 영향 없다.
  }
};

export interface CommunityPostInput {
  category: CommunityPostCategory;
  title: string;
  content: string;
  mediaItems: CommunityMediaItem[];
  /** 오늘 온 전리품 전용 */
  albumIds?: number[];
  /** 정보 게시판 전용 */
  placeName?: string | null;
  placeAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export const createCommunityPost = async (input: CommunityPostInput): Promise<number> => {
  const userId = await requireUserId();
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new AppError('DB-001', '제목을 입력해주세요.');
  if (!content) throw new AppError('DB-001', '내용을 입력해주세요.');

  const { data, error } = await supabase
    .from('COMMUNITY_POST')
    .insert({
      CATEGORY: input.category,
      TITLE: title.slice(0, 100),
      CONTENT: content.slice(0, 5000),
      MEDIA_ITEMS: input.mediaItems,
      AUTHOR_ID: userId,
      PLACE_NAME: input.category === 'INFO' ? (input.placeName?.trim() || null) : null,
      PLACE_ADDRESS: input.category === 'INFO' ? (input.placeAddress?.trim() || null) : null,
      LATITUDE: input.category === 'INFO' ? (input.latitude ?? null) : null,
      LONGITUDE: input.category === 'INFO' ? (input.longitude ?? null) : null,
    })
    .select('POST_ID')
    .single();
  if (error || !data) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '게시글 작성에 실패했습니다.', error);
  }

  const postId = (data as any).POST_ID as number;
  if (input.category === 'ARRIVAL' && input.albumIds?.length) {
    const rows = [...new Set(input.albumIds)].map((albumId) => ({ POST_ID: postId, ALBUM_ID: albumId }));
    const { error: albumError } = await supabase.from('COMMUNITY_POST_ALBUM').insert(rows);
    if (albumError) {
      // 본문은 이미 작성됐다 — 앨범 첨부만 실패했다고 전체를 실패로 되돌리지 않고
      // 알린다. 글은 남고, 유저가 다시 앨범을 추가할 수 있게 한다.
      throw new AppError('DB-001', '게시글은 등록됐지만 앨범 첨부에 실패했습니다.', albumError);
    }
  }
  return postId;
};

/** 작성자 본인 또는 관리자만 — RLS가 실제 판정을 담당 */
export const deleteCommunityPost = async (postId: number): Promise<void> => {
  const { error } = await supabase.from('COMMUNITY_POST').delete().eq('POST_ID', postId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '게시글 삭제에 실패했습니다.', error);
  }
};

/** 게시글 첨부 이미지/영상 업로드(여러 건은 한 파일씩 호출) — 모바일은 Blob이
 * 아니라 RNFilePart({ uri, name, type })를 넘긴다(uploadSpinLogMedia와 동일
 * 이유: fetch(uri).blob()은 수십 MB 영상에서 멈추거나 조용히 실패한다). */
export const uploadCommunityPostMedia = async (file: (Blob & { name?: string }) | RNFilePart): Promise<CommunityMediaItem> => {
  const headers = await authHeaders();
  const form = new FormData();
  if ('uri' in file) {
    // RN FormData는 (name, { uri, name, type }) 형태만 받는다 — 세 번째
    // filename 인자가 없다(웹 Blob 경로와 시그니처가 다르다).
    form.append('file', file as any);
  } else {
    const filename = (file as File).name || 'image.jpg';
    form.append('file', file, filename);
  }
  const res = await fetch(`${getProxyBaseUrl()}/api/community-post/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '이미지 업로드에 실패했습니다.');
  }
  return (await res.json()) as CommunityMediaItem;
};

// ── QnA 답변 채택 ──────────────────────────────────────────────────

/** 질문 작성자 본인만 — RLS(UPDATE own) + DB 트리거(QNA·최상위 답변만)가 검증 */
export const acceptCommunityAnswer = async (postId: number, commentId: number): Promise<void> => {
  const { error } = await supabase
    .from('COMMUNITY_POST')
    .update({ ACCEPTED_COMMENT_ID: commentId })
    .eq('POST_ID', postId);
  if (error) {
    throw new AppError('DB-001', '답변 채택에 실패했습니다.', error);
  }
};

export const unacceptCommunityAnswer = async (postId: number): Promise<void> => {
  const { error } = await supabase
    .from('COMMUNITY_POST')
    .update({ ACCEPTED_COMMENT_ID: null })
    .eq('POST_ID', postId);
  if (error) {
    throw new AppError('DB-001', '채택 취소에 실패했습니다.', error);
  }
};

// ── 댓글(자유/정보/청음실/팁) 겸 답변(QnA) ────────────────────────────

export interface CommunityComment {
  COMMENT_ID: number;
  POST_ID: number;
  USER_ID: string;
  PARENT_COMMENT_ID: number | null;
  CONTENT: string;
  CREATED_AT: string;
  DISPLAY_NAME: string | null;
  PROFILE_IMAGE_URL: string | null;
  LIKE_COUNT: number;
  LIKED_BY_ME: boolean;
  /** 이 댓글/답변에 달린 대댓글들 (1단계 스레딩) */
  replies: CommunityComment[];
}

export const getCommunityComments = async (postId: number): Promise<CommunityComment[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  const myId = session?.user?.id;

  const { data, error } = await supabase
    .from('COMMUNITY_COMMENT')
    .select('*')
    .eq('POST_ID', postId)
    .order('CREATED_AT', { ascending: true });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '댓글을 불러오는 데 실패했습니다.', error);
  }
  const rows = (data as any[]) || [];
  if (rows.length === 0) return [];

  const commentIds = rows.map((r) => r.COMMENT_ID);
  const [profileMap, likesRes] = await Promise.all([
    getProfilesLite(rows.map((r) => r.USER_ID)),
    supabase.from('COMMUNITY_COMMENT_LIKE').select('COMMENT_ID, USER_ID').in('COMMENT_ID', commentIds),
  ]);

  const likeCountMap: Record<number, number> = {};
  const likedByMeSet = new Set<number>();
  for (const l of (likesRes.data as { COMMENT_ID: number; USER_ID: string }[]) || []) {
    likeCountMap[l.COMMENT_ID] = (likeCountMap[l.COMMENT_ID] || 0) + 1;
    if (myId && l.USER_ID === myId) likedByMeSet.add(l.COMMENT_ID);
  }

  const byId: Record<number, CommunityComment> = {};
  const top: CommunityComment[] = [];
  for (const r of rows) {
    byId[r.COMMENT_ID] = {
      ...r,
      DISPLAY_NAME: profileMap[r.USER_ID]?.name || null,
      PROFILE_IMAGE_URL: profileMap[r.USER_ID]?.img || null,
      LIKE_COUNT: likeCountMap[r.COMMENT_ID] || 0,
      LIKED_BY_ME: likedByMeSet.has(r.COMMENT_ID),
      replies: [],
    };
  }
  for (const r of rows) {
    const c = byId[r.COMMENT_ID];
    // 부모가 대댓글인 경우(깊은 스레드)도 그 부모의 최상위 스레드로 평탄화
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

export const addCommunityComment = async (
  postId: number,
  content: string,
  parentCommentId?: number
): Promise<void> => {
  const userId = await requireUserId();
  const trimmed = content.trim();
  if (!trimmed) throw new AppError('DB-001', '내용을 입력해주세요.');
  const { error } = await supabase.from('COMMUNITY_COMMENT').insert({
    POST_ID: postId,
    USER_ID: userId,
    PARENT_COMMENT_ID: parentCommentId ?? null,
    CONTENT: trimmed.slice(0, 1000),
  });
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '등록에 실패했습니다.', error);
  }
};

/** 삭제 권한(작성자 본인, 게시글 작성자, 관리자)은 RLS가 판정 — 권한 없으면 0건 삭제 */
export const deleteCommunityComment = async (commentId: number): Promise<void> => {
  const { error } = await supabase.from('COMMUNITY_COMMENT').delete().eq('COMMENT_ID', commentId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '삭제에 실패했습니다.', error);
  }
};

export const likeCommunityComment = async (commentId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from('COMMUNITY_COMMENT_LIKE').insert({ COMMENT_ID: commentId, USER_ID: userId });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '좋아요 처리에 실패했습니다.', error);
  }
};

export const unlikeCommunityComment = async (commentId: number): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('COMMUNITY_COMMENT_LIKE').delete().eq('COMMENT_ID', commentId).eq('USER_ID', userId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '좋아요 취소에 실패했습니다.', error);
  }
};

// ── 신고 ──────────────────────────────────────────────────────────

/** 중복 신고(23505)는 이미 접수된 것으로 성공 취급 */
export const reportCommunityPost = async (postId: number, reason: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('COMMUNITY_POST_REPORT')
    .insert({ POST_ID: postId, REPORTER_ID: userId, REASON: reason.trim().slice(0, 300) || null });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '신고 접수에 실패했습니다.', error);
  }
};

export const reportCommunityComment = async (commentId: number, reason: string): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('COMMUNITY_COMMENT_REPORT')
    .insert({ COMMENT_ID: commentId, REPORTER_ID: userId, REASON: reason.trim().slice(0, 300) || null });
  if (error && error.code !== '23505') {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '신고 접수에 실패했습니다.', error);
  }
};
