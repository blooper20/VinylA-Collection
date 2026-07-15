import { supabase } from './supabase';
import { LISTENING_LOG, ALBUM_MASTER } from '@vinyla/shared-types';
import { AppError } from './errors';
import { logEvent } from './events';
import { getProxyBaseUrl } from './externalApi';

// 스피닝 다이어리 (Listening Log) — Letterboxd 다이어리처럼 "오늘 이 LP를
// 들었다"를 기록한다. RLS: public read / owner-only write (USER_VINYL과
// 동일 패턴) — 컬렉션 자체가 이미 전체 공개이므로 재생 기록 공개도 새로운
// 노출이 아니며, 디스커버리 피드의 데이터 소스로도 재사용된다.

export type ListeningLogWithAlbum = LISTENING_LOG & {
  ALBUM_MASTER: ALBUM_MASTER | null;
  /** 일부 화면(프로필 대시보드 등)에서 기록 주인의 닉네임을 붙여서 넘긴다 */
  DISPLAY_NAME?: string | null;
};

const isNetworkError = (error: any) =>
  error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError');

export interface SpinMedia {
  url: string;
  type: 'image' | 'video';
}

const guessExtension = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/jpeg': 'jpg',
    'video/webm': 'webm', 'video/quicktime': 'mov', 'video/mp4': 'mp4',
  };
  return map[mimeType] || (mimeType.startsWith('video/') ? 'mp4' : 'jpg');
};

// 스피닝 다이어리 미디어(사진 또는 15초 내외 영상) 업로드. 서버 라우트가
// 인증을 검증하고 spin-log-media 버킷의 본인 경로에 저장한 공개 URL을
// 돌려준다 — /api/support/upload와 동일한 패턴. 트리밍 결과물은 파일명이
// 없는 순수 Blob이라, 항상 MIME 타입 기반으로 파일명을 만들어 붙인다
// (그래야 서버가 확장자를 정확히 판단한다).
export const uploadSpinLogMedia = async (file: Blob & { name?: string }): Promise<SpinMedia> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-001', '로그인이 필요합니다.');

  const form = new FormData();
  const filename = (file as File).name || `media.${guessExtension(file.type)}`;
  form.append('file', file, filename);
  const res = await fetch(`${getProxyBaseUrl()}/api/spin-log/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-001', body.error || '미디어 업로드에 실패했습니다.');
  }
  return (await res.json()) as SpinMedia;
};

export const logSpin = async (
  userId: string,
  albumId: number,
  mood?: string,
  note?: string,
  media?: SpinMedia | null,
  isPublic: boolean = true,
  listenedAt?: string
): Promise<LISTENING_LOG> => {
  const { data, error } = await supabase
    .from('LISTENING_LOG')
    .insert({
      USER_ID: userId,
      ALBUM_ID: albumId,
      MOOD: mood || null,
      NOTE: note?.trim() || null,
      MEDIA_URL: media?.url || null,
      MEDIA_TYPE: media?.type || null,
      IS_PUBLIC: isPublic,
      LISTENED_AT: listenedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '재생 기록 저장에 실패했습니다.', error);
  }
  logEvent('SPIN_LOG', { albumId, hasMedia: !!media, isPublic });
  return data as LISTENING_LOG;
};

export const updateSpinLog = async (
  logId: number,
  patch: {
    mood?: string;
    note?: string;
    mediaUrl?: string | null;
    mediaType?: 'image' | 'video' | null;
    isPublic?: boolean;
    listenedAt?: string;
  }
): Promise<LISTENING_LOG> => {
  // 값이 아니라 "키가 있는지"로 판단한다 — 무드 프리셋을 선택 해제해 지우는
  // 경우 patch.mood가 undefined로 넘어오는데, `!== undefined` 체크였다면 이
  // 지우기 자체가 무시되어 DB에 반영되지 않았다. 같은 이유로 mediaUrl도
  // null을 명시적으로 넘기면(첨부 제거) 실제로 지워진다.
  const payload: Record<string, unknown> = {};
  if ('mood' in patch) payload.MOOD = patch.mood || null;
  if ('note' in patch) payload.NOTE = patch.note?.trim() || null;
  if ('mediaUrl' in patch) payload.MEDIA_URL = patch.mediaUrl || null;
  if ('mediaType' in patch) payload.MEDIA_TYPE = patch.mediaType || null;
  if ('isPublic' in patch) payload.IS_PUBLIC = patch.isPublic;
  if ('listenedAt' in patch) payload.LISTENED_AT = patch.listenedAt;

  const { data, error } = await supabase
    .from('LISTENING_LOG')
    .update(payload)
    .eq('LOG_ID', logId)
    .select()
    .single();

  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-001', '재생 기록 수정에 실패했습니다.', error);
  }
  return data as LISTENING_LOG;
};

export const deleteSpinLog = async (logId: number): Promise<void> => {
  const { error } = await supabase.from('LISTENING_LOG').delete().eq('LOG_ID', logId);
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-003', '재생 기록 삭제에 실패했습니다.', error);
  }
};

// 내 다이어리 — 커서(마지막으로 받은 LOG_ID) 기반 페이지네이션.
export const getMyListeningLog = async (
  userId: string,
  { limit = 20, beforeLogId }: { limit?: number; beforeLogId?: number } = {}
): Promise<ListeningLogWithAlbum[]> => {
  let query = supabase
    .from('LISTENING_LOG')
    .select('*, ALBUM_MASTER(*)')
    .eq('USER_ID', userId)
    .order('LISTENED_AT', { ascending: false })
    .limit(limit);

  if (beforeLogId) {
    // 정확한 커서는 아니지만(LISTENED_AT은 자유 수정 가능), 같은 정렬 기준으로
    // "이전 페이지의 마지막 LOG_ID보다 오래된 항목"을 근사 — 다이어리 규모에서
    // 중복/누락 위험이 실질적으로 없다.
    const { data: anchor } = await supabase
      .from('LISTENING_LOG')
      .select('LISTENED_AT')
      .eq('LOG_ID', beforeLogId)
      .maybeSingle();
    if (anchor?.LISTENED_AT) {
      query = query.lt('LISTENED_AT', anchor.LISTENED_AT);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError(isNetworkError(error) ? 'NET-001' : 'DB-002', '다이어리를 불러오는 데 실패했습니다.', error);
  }
  return (data as ListeningLogWithAlbum[]) || [];
};

// 공개 프로필 대시보드용 다이어리 히스토리 — 공개(IS_PUBLIC=true) 기록만.
// 프로필이 비공개인 유저는 RLS(can_view_profile)가 본인·관리자·수락된
// 팔로워 외의 조회를 행 단위로 차단하므로 여기서 접근 제어를 할 필요 없다.
export const getPublicListeningLog = async (
  userId: string,
  { limit = 30, beforeListenedAt }: { limit?: number; beforeListenedAt?: string } = {}
): Promise<ListeningLogWithAlbum[]> => {
  let query = supabase
    .from('LISTENING_LOG')
    .select('*, ALBUM_MASTER(*)')
    .eq('USER_ID', userId)
    .eq('IS_PUBLIC', true)
    .order('LISTENED_AT', { ascending: false })
    .limit(limit);
  if (beforeListenedAt) query = query.lt('LISTENED_AT', beforeListenedAt);

  const { data, error } = await query;
  if (error) return [];
  return (data as ListeningLogWithAlbum[]) || [];
};

// 앨범별 마지막 재생 시각 맵 — "오늘의 LP 추천"이 오래 안 들은 앨범에
// 가중치를 주기 위한 용도. 실패해도 던지지 않고 빈 객체를 반환해 랜덤 픽이
// 균등 랜덤으로 자연스럽게 폴백하게 한다.
export const getLastPlayedMap = async (userId: string): Promise<Record<number, string>> => {
  const { data, error } = await supabase
    .from('LISTENING_LOG')
    .select('ALBUM_ID, LISTENED_AT')
    .eq('USER_ID', userId)
    .order('LISTENED_AT', { ascending: false });

  if (error || !data) return {};

  const map: Record<number, string> = {};
  for (const row of data as { ALBUM_ID: number; LISTENED_AT: string }[]) {
    // 이미 내림차순 정렬이므로 각 앨범의 첫 등장이 가장 최근 재생.
    if (!(row.ALBUM_ID in map)) map[row.ALBUM_ID] = row.LISTENED_AT;
  }
  return map;
};
