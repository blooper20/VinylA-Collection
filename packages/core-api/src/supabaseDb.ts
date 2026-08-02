import { supabase } from './supabase';
import { ALBUM_MASTER, USER_VINYL, VINYL_TAG, AlbumTrack } from '@vinyla/shared-types';
import { logEvent } from './events';
import { AppError } from './errors';

// React Native's navigator has no onLine property (it is undefined, so a
// plain `!navigator.onLine` check reports "offline" on every device). Only
// trust the flag when the platform actually provides a boolean.
const isOffline = () =>
  typeof navigator !== 'undefined' &&
  typeof navigator.onLine === 'boolean' &&
  !navigator.onLine;

const isNetworkError = (error: any) => {
  return error?.message === 'Failed to fetch' || error?.message?.includes('NetworkError') || isOffline();
};

// =======================
// ALBUM_MASTER CRUD
// =======================

export const getAlbumMaster = async (albumId: number): Promise<ALBUM_MASTER | null> => {
  if (isOffline()) {
    throw new AppError('NET-001', '네트워크 연결이 끊겨 오프라인 상태입니다.');
  }

  // maybeSingle, not single: a missing row is the routine state for every
  // album nobody has saved yet — the first-ever save of ANY album passes
  // through here before createAlbumMaster runs. With .single() that 0-row
  // result surfaced as PGRST116 and the DB-002 throw below aborted the whole
  // save (regression introduced in the error-handling refactor).
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .select('*, VINYL_TAG(*)')
    .eq('ALBUM_ID', albumId)
    .maybeSingle();

  if (error) {
    console.warn('getAlbumMaster error or DB not connected:', error);
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 연결이 불안정합니다.', error);
    }
    throw new AppError('DB-002', '앨범 마스터 정보를 불러오는 데 실패했습니다.', error);
  }
  if (!data) return null;
  const master = data as any; // Cast to any to access VINYL_TAG easily
  if (master.VINYL_TAG && master.VINYL_TAG.length > 0) {
    master.GENRES = master.VINYL_TAG.map((t: any) => t.TAG_NAME);
  }
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('VINYL_A_LOCAL_MASTERS');
    if (local) {
      try {
        const masters = JSON.parse(local);
        if (masters[albumId]) {
          if (masters[albumId].GENRES) master.GENRES = masters[albumId].GENRES;
          if (masters[albumId].MARKET_PRICE) master.MARKET_PRICE = masters[albumId].MARKET_PRICE;
          if (masters[albumId].TRACKS?.length && (!master.TRACKS || master.TRACKS.length === 0)) {
            master.TRACKS = masters[albumId].TRACKS;
          }
        }
      } catch(e) {}
    }
  }
  return master;
};

export const createAlbumMaster = async (album: Partial<ALBUM_MASTER>): Promise<ALBUM_MASTER | null> => {
  const payload = { ...album };
  const genresToSave = payload.GENRES;
  // TRACKS는 jsonb 컬럼에 그대로 저장한다. 빈 배열은 "아직 못 구했다"는
  // 뜻이므로 null로 남겨 이후 set_album_tracks 백필이 채울 수 있게 한다.
  if (!payload.TRACKS || payload.TRACKS.length === 0) delete (payload as any).TRACKS;
  delete (payload as any).PURCHASE_PRICE;
  delete (payload as any).GENRES;
  
  // maybeSingle: with ignoreDuplicates the upsert returns zero rows when the
  // album already exists — .single() treated that as an error and skipped the
  // tag save below, so genres were never stored for pre-existing albums.
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .upsert([payload], { onConflict: 'ALBUM_ID', ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    console.warn('createAlbumMaster error or DB not connected, saving to localStorage:', error);
  } else if (genresToSave !== undefined) {
    // Insert new tags without deleting existing ones
    if (genresToSave.length > 0) {
      const tagsToInsert = genresToSave.map(g => ({
        ALBUM_ID: album.ALBUM_ID,
        TAG_TYPE: 'GENRE',
        TAG_NAME: g
      }));
      await supabase
        .from('VINYL_TAG')
        .upsert(tagsToInsert, { onConflict: 'ALBUM_ID,TAG_NAME', ignoreDuplicates: true });
    }
  }
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('VINYL_A_LOCAL_MASTERS') || '{}';
    const masters = JSON.parse(local);
    // Always preserve the full album containing MARKET_PRICE, GENRES, TRACKS
    masters[album.ALBUM_ID as number] = { ...(masters[album.ALBUM_ID as number] || {}), ...album };
    localStorage.setItem('VINYL_A_LOCAL_MASTERS', JSON.stringify(masters));
  }

  return error || !data ? (album as ALBUM_MASTER) : (data as ALBUM_MASTER);
};

// =======================
// ALBUM_RELEASE_TRACKS (실물반/release 단위 트랙 캐시)
// =======================
// ALBUM_MASTER.TRACKS(마스터 단위, 전 유저 공유)와 달리 이 테이블은 정확한
// Discogs release id로 키가 잡혀 있어 서로 다른 프레싱끼리 오염될 수 없다
// — 같은 프레싱을 가진 유저끼리는 안전하게 캐시를 공유한다.

export const getReleaseTracks = async (releaseId: number | string): Promise<AlbumTrack[] | null> => {
  if (!releaseId || isOffline()) return null;
  const { data, error } = await supabase
    .from('ALBUM_RELEASE_TRACKS')
    .select('TRACKS')
    .eq('DISCOGS_RELEASE_ID', Number(releaseId))
    .maybeSingle();
  if (error || !data) return null;
  return (data as { TRACKS: AlbumTrack[] }).TRACKS;
};

// 캐시 행은 한 번 채워지면 불변(그 실물반의 트랙리스트는 안 바뀜)이라
// 중복 삽입은 조용히 무시한다 — ALBUM_MASTER처럼 UPDATE 정책을 둘 필요가 없다.
export const saveReleaseTracks = async (releaseId: number | string, tracks: AlbumTrack[]): Promise<void> => {
  if (!releaseId || !tracks || tracks.length === 0 || isOffline()) return;
  const { error } = await supabase
    .from('ALBUM_RELEASE_TRACKS')
    .upsert([{ DISCOGS_RELEASE_ID: Number(releaseId), TRACKS: tracks }], {
      onConflict: 'DISCOGS_RELEASE_ID',
      ignoreDuplicates: true,
    });
  if (error) console.warn('saveReleaseTracks 실패(마이그레이션 미실행?):', error.message);
};

// 유저가 상세화면의 "프레싱 선택" UI로 자기 소장반을 직접 지정할 때 호출.
export const updateUserVinylReleaseId = async (
  userVinylId: number,
  releaseId: number | string
): Promise<void> => {
  // CUSTOM_PRESSING_ID와 상호 배타적 — 공식 Discogs 프레싱을 고르면
  // 커뮤니티 등록 참조는 비운다.
  const { error } = await supabase
    .from('USER_VINYL')
    .update({ DISCOGS_RELEASE_ID: Number(releaseId), CUSTOM_PRESSING_ID: null })
    .eq('USER_VINYL_ID', userVinylId);
  if (error) throw error;
};

// =======================
// USER_VINYL CRUD
// =======================

export const getUserVinyls = async (userId: string | number): Promise<any[]> => {
  if (isOffline()) {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const localV = localStorage.getItem('VINYL_A_LOCAL_COLLECTION');
      const localM = localStorage.getItem('VINYL_A_LOCAL_MASTERS');
      if (localV) {
        const vinyls = JSON.parse(localV);
        const masters = localM ? JSON.parse(localM) : {};
        return vinyls.map((v: any) => ({
          ...v,
          ALBUM_MASTER: masters[v.ALBUM_ID] || null,
        }));
      }
    }
    throw new AppError('NET-001', '네트워크 연결이 끊겨 오프라인 상태입니다.');
  }

  const { data, error } = await supabase
    .from('USER_VINYL')
    .select('*, ALBUM_MASTER(*, VINYL_TAG(*))')
    .eq('USER_ID', userId);

  if (error) {
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 연결이 불안정하여 컬렉션을 불러올 수 없습니다.', error);
    }
    throw new AppError('DB-002', '사용자 컬렉션을 불러오는 데 실패했습니다.', error);
  }
  
  if (!data || data.length === 0) {
    return [];
  }

  if (data && data.length > 0) {
    data.forEach(d => {
      if (d.ALBUM_MASTER && d.ALBUM_MASTER.VINYL_TAG && d.ALBUM_MASTER.VINYL_TAG.length > 0) {
        d.ALBUM_MASTER.GENRES = d.ALBUM_MASTER.VINYL_TAG.map((t: any) => t.TAG_NAME);
      }
    });

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const localM = localStorage.getItem('VINYL_A_LOCAL_MASTERS');
      if (localM) {
        try {
          const masters = JSON.parse(localM);
          data.forEach(d => {
            if (d.ALBUM_MASTER && masters[d.ALBUM_ID]) {
              if (masters[d.ALBUM_ID].MARKET_PRICE) {
                d.ALBUM_MASTER.MARKET_PRICE = d.ALBUM_MASTER.MARKET_PRICE || masters[d.ALBUM_ID].MARKET_PRICE;
              }
              if (masters[d.ALBUM_ID].GENRES && (!d.ALBUM_MASTER.GENRES || d.ALBUM_MASTER.GENRES.length === 0)) {
                d.ALBUM_MASTER.GENRES = masters[d.ALBUM_ID].GENRES;
              }
              if (masters[d.ALBUM_ID].TRACKS?.length && (!d.ALBUM_MASTER.TRACKS || d.ALBUM_MASTER.TRACKS.length === 0)) {
                d.ALBUM_MASTER.TRACKS = masters[d.ALBUM_ID].TRACKS;
              }
            }
          });
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }

  return data;
};

export const wipeUserData = async (userId: string): Promise<void> => {
  if (isOffline()) {
    throw new AppError('NET-001', '네트워크 연결이 끊겨 오프라인 상태입니다.');
  }
  const { error } = await supabase
    .from('USER_VINYL')
    .delete()
    .eq('USER_ID', userId);
    
  if (error) {
    console.warn('wipeUserData error:', error);
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 연결이 불안정하여 데이터를 초기화할 수 없습니다.', error);
    }
    throw new AppError('DB-003', '사용자 데이터 초기화 중 오류가 발생했습니다.', error);
  }
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('VINYL_A_LOCAL_COLLECTION');
    localStorage.removeItem('vinyls_dbData');
  }
};

export const upsertUserVinyl = async (
  userVinyl: Partial<USER_VINYL>
): Promise<(USER_VINYL & { isFirstEverSave?: boolean }) | null> => {
  // 이 유저가 이 앨범에 대해 이미 가진 "기본" 행을 조회한다. 같은 앨범을
  // 여러 에디션으로 등록하는 경우(insertUserVinylEdition)는 별도 함수를
  // 쓰므로, 여기서는 (USER_ID, ALBUM_ID) 최초 매치 한 건만 갱신 대상으로
  // 본다 — USER_VINYL_ID로 update하기 때문에 DB 유니크 제약에 의존하지
  // 않는다(에디션 다중 등록을 위해 그 제약은 제거됨).
  let existing = null;
  if (userVinyl.USER_ID && userVinyl.ALBUM_ID) {
    const { data } = await supabase
      .from('USER_VINYL')
      .select('*')
      .eq('USER_ID', userVinyl.USER_ID)
      .eq('ALBUM_ID', userVinyl.ALBUM_ID)
      .maybeSingle();
    existing = data;
  }

  const { data, error } = existing
    ? await supabase
        .from('USER_VINYL')
        .update(userVinyl)
        .eq('USER_VINYL_ID', existing.USER_VINYL_ID)
        .select()
        .single()
    : await supabase
        .from('USER_VINYL')
        .insert([userVinyl])
        .select()
        .single();

  let isFirstEverSave = false;
  if (!error && !existing) {
    logEvent(userVinyl.STATUS === 'WISH' ? 'WISH_ADD' : 'ALBUM_ADD', { albumId: userVinyl.ALBUM_ID });
    if (userVinyl.USER_ID) {
      // 방금 넣은 행이 이 유저의 유일한 행이면 "첫 저장" — 온보딩 축하 메시지에 사용.
      const { count } = await supabase
        .from('USER_VINYL')
        .select('*', { count: 'exact', head: true })
        .eq('USER_ID', userVinyl.USER_ID);
      isFirstEverSave = count === 1;
    }
  } else if (!error && existing?.STATUS === 'WISH' && userVinyl.STATUS === 'OWNED') {
    // 위시 → 보유 전환 (admin 대시보드의 전환율 지표)
    logEvent('ALBUM_ADD', { albumId: userVinyl.ALBUM_ID, fromWish: true });
  }

  if (error) {
    if (isNetworkError(error)) {
      // Offline fallback: save to localStorage
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('VINYL_A_LOCAL_COLLECTION');
        let arr = local ? JSON.parse(local) : [];
        const existingIdx = arr.findIndex((v: any) => v.ALBUM_ID === userVinyl.ALBUM_ID);
        if (existingIdx > -1) {
          arr[existingIdx] = { ...arr[existingIdx], ...userVinyl };
        } else {
          arr.push(userVinyl);
        }
        localStorage.setItem('VINYL_A_LOCAL_COLLECTION', JSON.stringify(arr));
      }
      throw new AppError('NET-001', '네트워크 오류로 오프라인 보관함에 임시 저장되었습니다.', error);
    }
    throw new AppError('DB-001', '앨범 저장 중 오류가 발생했습니다.', error);
  }
  return data ? { ...(data as USER_VINYL), isFirstEverSave } : null;
};

// "또 등록" 전용 — 이미 같은 (USER_ID, ALBUM_ID) 행이 있어도 확인하지 않고
// 항상 새 행을 만든다. 초반/재반/컬러반처럼 같은 앨범을 여러 장 독립적으로
// 소장·관리하기 위한 함수(upsertUserVinyl과 달리 기존 행을 갱신하지 않음).
export const insertUserVinylEdition = async (
  userVinyl: Partial<USER_VINYL>
): Promise<USER_VINYL | null> => {
  const { data, error } = await supabase
    .from('USER_VINYL')
    .insert([userVinyl])
    .select()
    .single();

  if (error) {
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 오류로 저장하지 못했습니다.', error);
    }
    throw new AppError('DB-001', '앨범 저장 중 오류가 발생했습니다.', error);
  }
  logEvent(userVinyl.STATUS === 'WISH' ? 'WISH_ADD' : 'ALBUM_ADD', { albumId: userVinyl.ALBUM_ID });
  return data as USER_VINYL;
};

// 이미 보관함에 있는 항목의 에디션 정보를 수정한다 — 예전에 그냥 저장해둔
// 앨범에 LP 종류나 에디션 구분을 나중에 붙이거나, 색/표시 여부를 바꾸는 경로.
// 선택을 모두 해제하면 에디션 표시 자체를 없애는 것으로 보고 관련 값을 지운다.
export const updateUserVinylEdition = async (
  userVinylId: number,
  edition: {
    EDITION_LABEL: string | null;
    EDITION_COLOR: string | null;
    EDITION_COLOR_ALT: string | null;
    EDITION_STYLE: string | null;
    EDITION_SPLATTER_FORM: string | null;
    EDITION_TAG: string | null;
    EDITION_TAG_TEXT: string | null;
    EDITION_STICKER_STYLE: string | null;
    EDITION_ON_COVER: boolean;
  }
): Promise<void> => {
  // 라벨이 더 이상 필수가 아니므로(LP 종류만 지정하는 경우가 정상), "표시 없애기"는
  // 라벨·구분·디스크가 모두 비었을 때로 판단한다.
  const cleared =
    !edition.EDITION_LABEL?.trim() &&
    !edition.EDITION_TAG &&
    !edition.EDITION_STYLE &&
    !edition.EDITION_COLOR;
  const { error } = await supabase
    .from('USER_VINYL')
    .update(
      cleared
        ? {
            EDITION_LABEL: null,
            EDITION_COLOR: null,
            EDITION_COLOR_ALT: null,
            EDITION_STYLE: null,
            EDITION_SPLATTER_FORM: null,
            EDITION_TAG: null,
            EDITION_TAG_TEXT: null,
            EDITION_STICKER_STYLE: null,
            EDITION_ON_COVER: false,
          }
        : edition
    )
    .eq('USER_VINYL_ID', userVinylId);

  if (error) {
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 오류로 저장하지 못했습니다.', error);
    }
    throw new AppError('DB-001', '에디션 정보를 저장하지 못했습니다.', error);
  }
};

// DB-assigned, tamper-proof order this user completed /setup in (see the
// PROFILES.SIGNUP_NUMBER migration) — backs the founding_100 badge.
export const getSignupNumber = async (userId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('PROFILES')
    .select('SIGNUP_NUMBER')
    .eq('USER_ID', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.SIGNUP_NUMBER ?? null;
};

export const deleteUserVinyl = async (userVinylId: number): Promise<boolean> => {
  const { error } = await supabase
    .from('USER_VINYL')
    .delete()
    .eq('USER_VINYL_ID', userVinylId);

  if (error) {
    console.error('deleteUserVinyl error:', error);
    throw new AppError('DB-003', '앨범 삭제 중 오류가 발생했습니다.', error);
  }
  return true;
};

export const updateUserVinylIsPublic = async (userVinylId: number, isPublic: boolean): Promise<boolean> => {
  const { error } = await supabase
    .from('USER_VINYL')
    .update({ IS_PUBLIC: isPublic })
    .eq('USER_VINYL_ID', userVinylId);

  if (error) {
    console.error('updateUserVinylIsPublic error:', error);
    throw new AppError('DB-003', '공개 설정 변경 중 오류가 발생했습니다.', error);
  }
  return true;
};

// 컬렉션 "수정 모드"에서 드래그로 순서를 바꾼 뒤 호출 — 화면에 보이는
// 순서 그대로(0부터) SORT_ORDER를 다시 매긴다. PostgREST는 행마다 다른 값을
// 한 번의 upsert로 바꾸는 벌크 업데이트를 지원하지 않아 개별 update를
// 병렬로 날린다 — 개인 컬렉션 규모(수십~수백 장)에서는 문제 없는 수준.
export const updateUserVinylOrder = async (orderedUserVinylIds: number[]): Promise<boolean> => {
  const results = await Promise.all(
    orderedUserVinylIds.map((id, index) =>
      supabase.from('USER_VINYL').update({ SORT_ORDER: index }).eq('USER_VINYL_ID', id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error('updateUserVinylOrder error:', failed.error);
    throw new AppError('DB-003', '순서 저장 중 오류가 발생했습니다.', failed.error);
  }
  return true;
};

// =======================
// VINYL_TAG CRUD
// =======================

export const getVinylTags = async (albumId: number): Promise<VINYL_TAG[]> => {
  const { data, error } = await supabase
    .from('VINYL_TAG')
    .select('*')
    .eq('ALBUM_ID', albumId);

  if (error) {
    console.error('getVinylTags error:', error);
    return [];
  }
  return data as VINYL_TAG[];
};

export const addVinylTag = async (tag: Partial<VINYL_TAG>): Promise<VINYL_TAG | null> => {
  const { data, error } = await supabase
    .from('VINYL_TAG')
    .insert([tag])
    .select()
    .single();

  if (error) {
    console.error('addVinylTag error:', error);
    return null;
  }
  return data as VINYL_TAG;
};

// =======================
// UTILS: Map to Frontend
// =======================

export const mapToFrontendModel = (userVinyl: any, albumMaster?: any) => {
  const master = albumMaster || userVinyl?.ALBUM_MASTER;
  return {
    // 프레싱 선택(updateUserVinylReleaseId/selectCustomPressing) 등 이 특정
    // USER_VINYL 행을 갱신해야 하는 동작 전부가 이 id에 의존한다 — 빠지면
    // 그런 동작이 로컬 상태만 바뀌고 DB에는 조용히 반영 안 되는 버그가 된다.
    USER_VINYL_ID: userVinyl?.USER_VINYL_ID,
    ALBUM_ID: master?.ALBUM_ID || userVinyl?.ALBUM_ID,
    TITLE: master?.TITLE || 'Unknown Title',
    ARTIST: master?.ARTIST || 'Unknown Artist',
    // 유저가 직접 찍어 올린 재킷 사진이 있으면 그게 우선 — 같은 앨범이라도
    // 에디션마다 실물 재킷이 달라, 공유 마스터 커버가 내 판과 다를 수 있다.
    COVER_URL: userVinyl?.CUSTOM_IMAGE_URL || master?.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    IMAGE_URL: userVinyl?.CUSTOM_IMAGE_URL || master?.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    // 개인 커버 사용 여부를 소비자(DetailModal 등)가 구분할 수 있게 원본도 노출
    CUSTOM_IMAGE_URL: userVinyl?.CUSTOM_IMAGE_URL || null,
    // 밖으로 나가는 화면(공유 이미지 등)용: '나만 보기' 개인 커버를 배제한
    // 공유 마스터의 커버
    MASTER_IMAGE_URL: master?.IMAGE_URL || '',
    RELEASE_YEAR: master?.RELEASE_YEAR || 2024,
    GENRES: master?.GENRES && master.GENRES.length > 0 ? master.GENRES : ['Vinyl'],
    // DB(또는 localStorage 미러)에 백필된 트랙리스트 — 상세 모달이 이걸로
    // 시드해서 외부 API 라이브 조회 없이 즉시 표시한다.
    TRACKS: master?.TRACKS || [],
    VINYL_IMAGE_URL: master?.VINYL_IMAGE_URL || '',
    CUSTOM_STYLE_TYPE: (master?.CUSTOM_STYLE_TYPE || 'SOLID') as 'SOLID' | 'TRANSLUCENT' | 'SPLATTER',
    STATUS: userVinyl?.STATUS || 'WISH',
    PURCHASE_PRICE: userVinyl?.PURCHASE_PRICE || 0,
    PURCHASE_DATE: userVinyl?.CREATED_AT || userVinyl?.PURCHASE_DATE || '',
    CUSTOM_COLOR_HEX: master?.CUSTOM_COLOR_HEX || '#1a1c1c',
    MARKET_PRICE: master?.MARKET_PRICE || 0,
    IS_PUBLIC: userVinyl?.IS_PUBLIC !== false,
    // 유저가 소장한 정확한 실물반(Discogs release). 있으면 상세 모달이
    // ALBUM_RELEASE_TRACKS에서 정확한 트랙/사이드를 가져온다.
    DISCOGS_RELEASE_ID: userVinyl?.DISCOGS_RELEASE_ID ?? null,
    CUSTOM_PRESSING_ID: userVinyl?.CUSTOM_PRESSING_ID ?? null,
    // 컬렉션 "수정 모드" 드래그 정렬 순서. NULL = 아직 수동 정렬한 적 없음.
    SORT_ORDER: userVinyl?.SORT_ORDER ?? null,
    // 같은 앨범의 여러 소장/위시 항목을 구분하는 에디션 라벨(예: "그린반")과
    // 그 시각 표현 — 색이 있으면 디스크 색으로, 없으면 하이프 스티커로 커버에
    // 드러낸다(resolveEditionVisual 참고).
    EDITION_LABEL: userVinyl?.EDITION_LABEL ?? null,
    EDITION_COLOR: userVinyl?.EDITION_COLOR ?? null,
    EDITION_COLOR_ALT: userVinyl?.EDITION_COLOR_ALT ?? null,
    EDITION_STYLE: userVinyl?.EDITION_STYLE ?? null,
    EDITION_SPLATTER_FORM: userVinyl?.EDITION_SPLATTER_FORM ?? null,
    EDITION_TAG: userVinyl?.EDITION_TAG ?? null,
    EDITION_TAG_TEXT: userVinyl?.EDITION_TAG_TEXT ?? null,
    EDITION_STICKER_STYLE: userVinyl?.EDITION_STICKER_STYLE ?? null,
    EDITION_ON_COVER: userVinyl?.EDITION_ON_COVER ?? false,
    // 커뮤니티 등록(위키형) 앨범 여부와 그 트랙리스트 — 상세 모달이 이 값이
    // 있으면 외부 API 라이브 조회 없이 바로 트랙을 표시한다.
    SOURCE: master?.SOURCE || 'DISCOGS',
    SUBMITTED_BY: master?.SUBMITTED_BY ?? null,
    COMMUNITY_TRACKS: master?.COMMUNITY_TRACKS ?? null
  };
};

// ── 사용자 촬영 재킷 커버 ─────────────────────────────────────────
// 같은 앨범이라도 에디션마다 실물 재킷이 달라 공유 마스터 커버가 내 판과
// 다를 수 있다. 촬영본을 user-covers 버킷에 올리고(서버 라우트가 인증 검증),
// 그 URL을 내 USER_VINYL 행에만 기록한다 — 다른 유저의 커버는 그대로.

export const uploadUserCover = async (albumId: number, file: Blob): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-004', '로그인이 필요합니다.');

  const proxyBase = (globalThis as any).__VINYLA_API_BASE__ || '';
  const form = new FormData();
  form.append('file', file, 'cover.jpg');
  form.append('albumId', String(albumId));
  const res = await fetch(`${proxyBase}/api/user-cover/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-004', body.error || '커버 업로드에 실패했습니다.');
  }
  return (await res.json()).url as string;
};

export const setUserVinylCover = async (
  userVinylId: number,
  coverUrl: string | null
): Promise<void> => {
  // .update()만 쓰면 USER_VINYL_ID가 이미 지워졌거나(문의 #20/#21처럼 호출부가
  // 낡은/잘못된 id를 들고 있는 경우) 매칭되는 행이 0개여도 Supabase가 에러를
  // 던지지 않는다 — 화면에서는 "저장됐다"는 토스트까지 뜨고 실제로는 아무 것도
  // 바뀌지 않는 조용한 실패가 발생한다. .select()로 실제 갱신된 행을 돌려받아
  // 0건이면 명시적으로 에러를 던져, 이런 케이스가 다시는 조용히 묻히지 않게 한다.
  const { data, error } = await supabase
    .from('USER_VINYL')
    .update({ CUSTOM_IMAGE_URL: coverUrl })
    .eq('USER_VINYL_ID', userVinylId)
    .select('USER_VINYL_ID');
  if (error) {
    throw new AppError('DB-004', '커버 변경 사항을 저장하지 못했습니다.', error);
  }
  if (!data || data.length === 0) {
    throw new AppError(
      'DB-004',
      '커버 변경 사항을 저장하지 못했습니다.',
      new Error(`setUserVinylCover: no USER_VINYL row matched USER_VINYL_ID=${userVinylId}`)
    );
  }
};

// ALBUM_MASTER는 RLS에서 클라이언트 UPDATE가 차단돼 있어(공유 데이터 보호)
// 커버 교정은 인증·URL 화이트리스트를 검증하는 서버 라우트를 경유한다.
// 쓰임새 둘: ① 검색 파이프라인이 실물 LP 커버를 주도록 개선된 뒤에도
// 남아 있는 옛 마스터 커버의 갱신, ② 재킷 촬영 기능의 "모두에게 적용".
export const updateAlbumMasterImage = async (albumId: number, imageUrl: string): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-004', '로그인이 필요합니다.');

  const proxyBase = (globalThis as any).__VINYLA_API_BASE__ || '';
  const res = await fetch(`${proxyBase}/api/album-master/cover`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ albumId, imageUrl }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-004', body.error || '커버 갱신에 실패했습니다.');
  }
};

// 마스터 커버를 서버가 백업해둔 '기존(카탈로그) 커버'로 복원한다.
// 복원된 URL을 반환하고, 백업이 없어 복원 불가면 null (호출부가 카탈로그
// 커버를 새로 구해 updateAlbumMasterImage로 치유하는 폴백을 밟는다).
export const revertAlbumMasterCover = async (albumId: number): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AppError('DB-004', '로그인이 필요합니다.');

  const proxyBase = (globalThis as any).__VINYLA_API_BASE__ || '';
  const res = await fetch(`${proxyBase}/api/album-master/cover`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ albumId, action: 'revert' }),
  });
  if (res.status === 409) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AppError('DB-004', body.error || '커버 복원에 실패했습니다.');
  }
  const body = await res.json().catch(() => ({}));
  return typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : null;
};
