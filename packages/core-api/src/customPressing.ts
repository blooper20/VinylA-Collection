import { supabase } from './supabase';
import { AppError } from './errors';
import { getProfilesLite } from './profile';
import { AlbumTrack } from '@vinyla/shared-types';

// 유저가 직접 입력한 프레싱(사이드별 트랙리스트) — Discogs/알라딘 어디에도
// 없는 실물반을 위한 최후 수단. "다른 프레싱 선택"에서 공식 프레싱과 함께
// 같은 앨범의 다른 유저가 올린 공개 등록도 보여준다(게시글처럼) — 비공개면
// 등록한 본인에게만 보인다(DB RLS가 강제, 여기 조회 함수는 그 결과를 그대로
// 프론트 모델로 옮길 뿐이다).

export interface CustomPressing {
  PRESSING_ID: number;
  ALBUM_ID: number;
  SUBMITTED_BY: string;
  TITLE: string;
  TRACKS: AlbumTrack[];
  IS_PUBLIC: boolean;
  CREATED_AT?: string;
  submitterName: string | null;
  submitterImg: string | null;
  selectionCount: number;
}

export const getCustomPressingsForAlbum = async (albumId: number | string): Promise<CustomPressing[]> => {
  const { data, error } = await supabase
    .from('CUSTOM_PRESSING')
    .select('*')
    .eq('ALBUM_ID', Number(albumId))
    .order('CREATED_AT', { ascending: false });
  if (error || !data || data.length === 0) return [];

  const rows = data as any[];
  const [profiles, counts] = await Promise.all([
    getProfilesLite(rows.map((r) => r.SUBMITTED_BY)),
    supabase.rpc('get_custom_pressing_selection_counts', { p_pressing_ids: rows.map((r) => r.PRESSING_ID) }),
  ]);
  const countMap: Record<number, number> = {};
  for (const c of (counts.data as any[]) || []) countMap[c.pressing_id] = Number(c.selection_count);

  return rows.map((r) => ({
    PRESSING_ID: r.PRESSING_ID,
    ALBUM_ID: r.ALBUM_ID,
    SUBMITTED_BY: r.SUBMITTED_BY,
    TITLE: r.TITLE,
    TRACKS: r.TRACKS || [],
    IS_PUBLIC: r.IS_PUBLIC,
    CREATED_AT: r.CREATED_AT,
    submitterName: profiles[r.SUBMITTED_BY]?.name ?? null,
    submitterImg: profiles[r.SUBMITTED_BY]?.img ?? null,
    selectionCount: countMap[r.PRESSING_ID] || 0,
  }));
};

export const getCustomPressingById = async (pressingId: number | string): Promise<CustomPressing | null> => {
  const { data, error } = await supabase
    .from('CUSTOM_PRESSING')
    .select('*')
    .eq('PRESSING_ID', Number(pressingId))
    .maybeSingle();
  if (error || !data) return null;
  const r = data as any;
  const profiles = await getProfilesLite([r.SUBMITTED_BY]);
  return {
    PRESSING_ID: r.PRESSING_ID,
    ALBUM_ID: r.ALBUM_ID,
    SUBMITTED_BY: r.SUBMITTED_BY,
    TITLE: r.TITLE,
    TRACKS: r.TRACKS || [],
    IS_PUBLIC: r.IS_PUBLIC,
    CREATED_AT: r.CREATED_AT,
    submitterName: profiles[r.SUBMITTED_BY]?.name ?? null,
    submitterImg: profiles[r.SUBMITTED_BY]?.img ?? null,
    selectionCount: 0,
  };
};

export const createCustomPressing = async (
  albumId: number | string,
  userId: string,
  title: string,
  tracks: AlbumTrack[],
  isPublic: boolean
): Promise<number> => {
  const trimmedTitle = title.trim().slice(0, 80);
  const cleanTracks = tracks.filter((t) => t.title?.trim());
  if (!trimmedTitle) throw new AppError('DB-001', '프레싱 이름을 입력해주세요.');
  if (cleanTracks.length === 0) throw new AppError('DB-001', '트랙을 1개 이상 입력해주세요.');

  const { data, error } = await supabase
    .from('CUSTOM_PRESSING')
    .insert({
      ALBUM_ID: Number(albumId),
      SUBMITTED_BY: userId,
      TITLE: trimmedTitle,
      TRACKS: cleanTracks,
      IS_PUBLIC: isPublic,
    })
    .select('PRESSING_ID')
    .single();
  if (error || !data) throw new AppError('DB-001', '프레싱 등록에 실패했습니다.', error);
  return (data as any).PRESSING_ID;
};

// 유저가 소장한 실물반으로 커뮤니티 프레싱을 고르면, 상호 배타적인
// DISCOGS_RELEASE_ID는 비운다(둘 다 세팅되는 상태를 만들지 않는다).
export const selectCustomPressing = async (userVinylId: number, pressingId: number): Promise<void> => {
  const { error } = await supabase
    .from('USER_VINYL')
    .update({ CUSTOM_PRESSING_ID: pressingId, DISCOGS_RELEASE_ID: null })
    .eq('USER_VINYL_ID', userVinylId);
  if (error) throw new AppError('DB-001', '프레싱 선택에 실패했습니다.', error);
};

// 본인이 등록한 프레싱만 RLS가 수정을 허용한다 — 여기서 유저 일치를
// 다시 확인하진 않지만, 잘못된 유저가 시도하면 DB가 0 rows로 조용히
// 거부하므로 그 경우를 명시적 에러로 바꿔준다.
export const updateCustomPressing = async (
  pressingId: number,
  title: string,
  tracks: AlbumTrack[],
  isPublic: boolean
): Promise<void> => {
  const trimmedTitle = title.trim().slice(0, 80);
  const cleanTracks = tracks.filter((t) => t.title?.trim());
  if (!trimmedTitle) throw new AppError('DB-001', '프레싱 이름을 입력해주세요.');
  if (cleanTracks.length === 0) throw new AppError('DB-001', '트랙을 1개 이상 입력해주세요.');

  const { data, error } = await supabase
    .from('CUSTOM_PRESSING')
    .update({ TITLE: trimmedTitle, TRACKS: cleanTracks, IS_PUBLIC: isPublic })
    .eq('PRESSING_ID', pressingId)
    .select('PRESSING_ID');
  if (error) throw new AppError('DB-001', '프레싱 수정에 실패했습니다.', error);
  if (!data || data.length === 0) throw new AppError('DB-001', '수정 권한이 없습니다.');
};

// 삭제되는 프레싱을 소장반으로 선택해뒀던 유저(본인 포함)는 DB의
// ON DELETE SET NULL로 자동 해제된다 — 여기선 그냥 행만 지우면 된다.
export const deleteCustomPressing = async (pressingId: number): Promise<void> => {
  const { data, error } = await supabase
    .from('CUSTOM_PRESSING')
    .delete()
    .eq('PRESSING_ID', pressingId)
    .select('PRESSING_ID');
  if (error) throw new AppError('DB-001', '프레싱 삭제에 실패했습니다.', error);
  if (!data || data.length === 0) throw new AppError('DB-001', '삭제 권한이 없습니다.');
};
