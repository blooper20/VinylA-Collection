import { supabase } from './supabase';
import { ALBUM_MASTER, USER_VINYL, VINYL_TAG } from '@vinyla/shared-types';
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

  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .select('*, VINYL_TAG(*)')
    .eq('ALBUM_ID', albumId)
    .single();

  if (error) {
    console.warn('getAlbumMaster error or DB not connected:', error);
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 연결이 불안정합니다.', error);
    }
    throw new AppError('DB-002', '앨범 마스터 정보를 불러오는 데 실패했습니다.', error);
  }
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
        }
      } catch(e) {}
    }
  }
  return master;
};

export const createAlbumMaster = async (album: Partial<ALBUM_MASTER>): Promise<ALBUM_MASTER | null> => {
  const payload = { ...album };
  const genresToSave = payload.GENRES;
  delete (payload as any).TRACKS;
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

export const upsertUserVinyl = async (userVinyl: Partial<USER_VINYL>): Promise<USER_VINYL | null> => {
  // Read the current row first (only to decide which metric to log below —
  // the write itself is a single atomic upsert on (USER_ID, ALBUM_ID)).
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

  const payload = existing ? { ...existing, ...userVinyl } : userVinyl;

  const { data, error } = await supabase
    .from('USER_VINYL')
    .upsert([payload], { onConflict: 'USER_ID,ALBUM_ID' })
    .select()
    .single();

  if (!error && !existing) {
    logEvent(userVinyl.STATUS === 'WISH' ? 'WISH_ADD' : 'ALBUM_ADD', { albumId: userVinyl.ALBUM_ID });
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
  return data as USER_VINYL;
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

export const deleteUserVinylByAlbum = async (userId: string | number, albumId: number): Promise<boolean> => {
  if (isOffline()) {
    throw new AppError('NET-001', '네트워크 연결이 끊겨 오프라인 상태입니다.');
  }

  const { error } = await supabase
    .from('USER_VINYL')
    .delete()
    .eq('USER_ID', userId)
    .eq('ALBUM_ID', albumId);

  if (error) {
    console.error('deleteUserVinylByAlbum error:', error);
    if (isNetworkError(error)) {
      throw new AppError('NET-001', '네트워크 연결이 불안정하여 삭제할 수 없습니다.', error);
    }
    throw new AppError('DB-003', '앨범 삭제 중 오류가 발생했습니다.', error);
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
    ALBUM_ID: master?.ALBUM_ID || userVinyl?.ALBUM_ID,
    TITLE: master?.TITLE || 'Unknown Title',
    ARTIST: master?.ARTIST || 'Unknown Artist',
    COVER_URL: master?.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    IMAGE_URL: master?.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    RELEASE_YEAR: master?.RELEASE_YEAR || 2024,
    GENRES: master?.GENRES && master.GENRES.length > 0 ? master.GENRES : ['Vinyl'],
    VINYL_IMAGE_URL: master?.VINYL_IMAGE_URL || '',
    CUSTOM_STYLE_TYPE: (master?.CUSTOM_STYLE_TYPE || 'SOLID') as 'SOLID' | 'TRANSLUCENT' | 'SPLATTER',
    STATUS: userVinyl?.STATUS || 'WISH',
    PURCHASE_PRICE: userVinyl?.PURCHASE_PRICE || 0,
    PURCHASE_DATE: userVinyl?.CREATED_AT || userVinyl?.PURCHASE_DATE || '',
    CUSTOM_COLOR_HEX: master?.CUSTOM_COLOR_HEX || '#1a1c1c',
    MARKET_PRICE: master?.MARKET_PRICE || 0
  };
};
