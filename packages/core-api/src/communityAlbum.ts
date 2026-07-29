import { supabase } from './supabase';
import { AppError } from './errors';
import { getProfilesLite } from './profile';
import { AlbumTrack } from '@vinyla/shared-types';

// 커뮤니티 등록 앨범 — Discogs 카탈로그에 없는 음반을 유저가 직접(애플뮤직
// 검색으로 자동 확보하거나, 완전 수동 입력으로) 등록한다. ALBUM_MASTER를
// 그대로 확장해서 저장하므로(별도 테이블 아님 — 알라딘 소스 앨범이 이미
// ALADIN_ID_OFFSET으로 같은 테이블에 공존하는 선례를 따름) 등록 즉시 기존
// createAlbumMaster/upsertUserVinyl 경로, 앨범 카드/상세 렌더링이 전부 그대로
// 동작한다. 위키형이지만 진짜 위키처럼 아무나 고칠 수는 없다 — 등록자 본인만
// 수정 가능(RLS가 강제, CUSTOM_PRESSING과 동일한 소유권 모델). 항상 전체
// 공개다(비공개 옵션 없음 — 다른 유저 공개 피드에 제목/커버 없는 빈 카드로
// 노출되는 문제를 피하기 위함).

export interface CommunityAlbum {
  ALBUM_ID: number;
  TITLE: string;
  ARTIST: string;
  RELEASE_YEAR: number | null;
  IMAGE_URL: string | null;
  SOURCE: 'APPLE_MUSIC' | 'MANUAL';
  SUBMITTED_BY: string;
  APPLE_COLLECTION_ID: number | null;
  TRACKS: AlbumTrack[];
  CREATED_AT?: string;
  submitterName: string | null;
  submitterImg: string | null;
}

const mapRow = (r: any): CommunityAlbum => ({
  ALBUM_ID: r.ALBUM_ID,
  TITLE: r.TITLE,
  ARTIST: r.ARTIST,
  RELEASE_YEAR: r.RELEASE_YEAR ?? null,
  IMAGE_URL: r.IMAGE_URL ?? null,
  SOURCE: r.SOURCE,
  SUBMITTED_BY: r.SUBMITTED_BY,
  APPLE_COLLECTION_ID: r.APPLE_COLLECTION_ID ?? null,
  TRACKS: r.COMMUNITY_TRACKS || [],
  CREATED_AT: r.CREATED_AT,
  submitterName: null,
  submitterImg: null,
});

const withSubmitterProfiles = async (rows: CommunityAlbum[]): Promise<CommunityAlbum[]> => {
  if (rows.length === 0) return rows;
  const profiles = await getProfilesLite(rows.map((r) => r.SUBMITTED_BY));
  return rows.map((r) => ({
    ...r,
    submitterName: profiles[r.SUBMITTED_BY]?.name ?? null,
    submitterImg: profiles[r.SUBMITTED_BY]?.img ?? null,
  }));
};

export const getCommunityAlbums = async (opts: {
  query?: string;
  limit?: number;
  before?: string; // CREATED_AT cursor for pagination
} = {}): Promise<CommunityAlbum[]> => {
  const limit = opts.limit ?? 30;
  let q = supabase
    .from('ALBUM_MASTER')
    .select('*')
    .neq('SOURCE', 'DISCOGS')
    .order('CREATED_AT', { ascending: false })
    .limit(limit);

  if (opts.before) q = q.lt('CREATED_AT', opts.before);
  if (opts.query?.trim()) {
    const term = opts.query.trim().replace(/[%_]/g, '');
    q = q.or(`TITLE.ilike.%${term}%,ARTIST.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return withSubmitterProfiles((data as any[]).map(mapRow));
};

export const getCommunityAlbumById = async (albumId: number | string): Promise<CommunityAlbum | null> => {
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .select('*')
    .eq('ALBUM_ID', Number(albumId))
    .neq('SOURCE', 'DISCOGS')
    .maybeSingle();
  if (error || !data) return null;
  const [mapped] = await withSubmitterProfiles([mapRow(data)]);
  return mapped;
};

// 수동 입력 경로는 커버 이미지를 앨범 행이 생기기 전에 올려야 한다(업로드
// 라우트가 albumId를 경로에 요구함) — 그래서 ID 발급을 insert와 분리한다.
// 예약만 하고 실제로 쓰지 않아도(등록 중단 등) 시퀀스에 구멍이 나는 것뿐이라
// 문제 없다.
export const reserveCommunityAlbumId = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('next_community_album_id');
  if (error || data == null) throw new AppError('DB-001', '앨범 등록에 실패했습니다.', error);
  return Number(data);
};

export interface CreateCommunityAlbumInput {
  albumId?: number; // reserveCommunityAlbumId()로 미리 받아둔 ID(커버 업로드에 썼다면 그대로 재사용)
  title: string;
  artist: string;
  releaseYear?: number | null;
  imageUrl?: string | null;
  tracks: AlbumTrack[];
  source: 'APPLE_MUSIC' | 'MANUAL';
  appleCollectionId?: number | null;
}

// 앨범 자체를 새로 등록하는 것 — 컬렉션에 담는 것(upsertUserVinyl)은 이 함수가
// 반환한 ALBUM_ID로 호출자가 별도로 처리한다(기존 add-to-collection 흐름 재사용).
export const createCommunityAlbum = async (
  userId: string,
  input: CreateCommunityAlbumInput
): Promise<{ albumId: number; reused: boolean }> => {
  const title = input.title.trim().slice(0, 200);
  const artist = input.artist.trim().slice(0, 200);
  const cleanTracks = input.tracks.filter((t) => t.title?.trim());
  if (!title) throw new AppError('DB-001', '앨범 제목을 입력해주세요.');
  if (!artist) throw new AppError('DB-001', '아티스트명을 입력해주세요.');
  if (cleanTracks.length === 0) throw new AppError('DB-001', '트랙을 1개 이상 입력해주세요.');

  // 같은 애플뮤직 앨범을 다른 유저가 이미 등록했으면 중복 행을 만들지 않고
  // 기존 행을 재사용한다(idx_album_master_apple_collection 유니크 인덱스가
  // DB 레벨에서도 이를 보장 — 여기선 유저 경험상 조용히 폴백하기 위해 미리 조회).
  if (input.appleCollectionId) {
    const { data: existing } = await supabase
      .from('ALBUM_MASTER')
      .select('ALBUM_ID')
      .eq('APPLE_COLLECTION_ID', input.appleCollectionId)
      .maybeSingle();
    if (existing) return { albumId: (existing as any).ALBUM_ID, reused: true };
  }

  const albumId = input.albumId ?? (await reserveCommunityAlbumId());

  const { error } = await supabase.from('ALBUM_MASTER').insert({
    ALBUM_ID: albumId,
    TITLE: title,
    ARTIST: artist,
    RELEASE_YEAR: input.releaseYear ?? null,
    IMAGE_URL: input.imageUrl ?? null,
    SOURCE: input.source,
    SUBMITTED_BY: userId,
    APPLE_COLLECTION_ID: input.appleCollectionId ?? null,
    COMMUNITY_TRACKS: cleanTracks,
  });
  if (error) throw new AppError('DB-001', '앨범 등록에 실패했습니다.', error);
  return { albumId, reused: false };
};

// 등록 직후 오타를 고치는 흔한 케이스는 살리되, 다른 유저가 이미 이 앨범을
// 자기 컬렉션에 담은 뒤에는(=남이 이 데이터에 의존하기 시작한 뒤에는) 등록자
// 본인도 수정할 수 없다 — RLS도 동일 조건으로 강제하므로 이건 그냥 UI가
// "왜 안 되는지" 미리 알려주기 위한 조회일 뿐, 이 체크를 우회해도 실제
// 쓰기는 DB가 막는다.
export const communityAlbumHasOtherAdopters = async (albumId: number): Promise<boolean> => {
  const { data, error } = await supabase.rpc('community_album_has_other_adopters', { p_album_id: albumId });
  if (error) return false;
  return !!data;
};

export interface UpdateCommunityAlbumInput {
  title: string;
  artist: string;
  releaseYear?: number | null;
  imageUrl?: string | null;
  tracks: AlbumTrack[];
}

// 등록자 본인만, 그리고 아직 아무도 담지 않았을 때만 RLS가 수정을 허용한다 —
// 다른 유저가 시도하거나 이미 누군가 담았으면 0 rows로 조용히 거부되므로 그
// 경우를 명시적 에러로 바꿔준다(customPressing.ts와 동일 패턴). 어느 쪽
// 사유인지 미리 구분해서 알려주기 위해 update 시도 전에 한 번 더 확인한다.
export const updateCommunityAlbum = async (
  albumId: number,
  input: UpdateCommunityAlbumInput
): Promise<void> => {
  const title = input.title.trim().slice(0, 200);
  const artist = input.artist.trim().slice(0, 200);
  const cleanTracks = input.tracks.filter((t) => t.title?.trim());
  if (!title) throw new AppError('DB-001', '앨범 제목을 입력해주세요.');
  if (!artist) throw new AppError('DB-001', '아티스트명을 입력해주세요.');
  if (cleanTracks.length === 0) throw new AppError('DB-001', '트랙을 1개 이상 입력해주세요.');

  if (await communityAlbumHasOtherAdopters(albumId)) {
    throw new AppError('DB-001', '다른 유저가 이미 담은 앨범이라 수정할 수 없어요.');
  }

  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .update({
      TITLE: title,
      ARTIST: artist,
      RELEASE_YEAR: input.releaseYear ?? null,
      IMAGE_URL: input.imageUrl ?? null,
      COMMUNITY_TRACKS: cleanTracks,
    })
    .eq('ALBUM_ID', albumId)
    .select('ALBUM_ID');
  if (error) throw new AppError('DB-001', '앨범 수정에 실패했습니다.', error);
  if (!data || data.length === 0) throw new AppError('DB-001', '수정 권한이 없습니다.');
};
