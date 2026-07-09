import { supabase } from './supabase';
import { ALBUM_MASTER, USER_VINYL, VINYL_TAG } from '@vinyla/shared-types';

// =======================
// ALBUM_MASTER CRUD
// =======================

export const getAlbumMaster = async (albumId: number): Promise<ALBUM_MASTER | null> => {
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .select('*, VINYL_TAG(*)')
    .eq('ALBUM_ID', albumId)
    .single();

  if (error) {
    console.warn('getAlbumMaster error or DB not connected:', error);
    return null;
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
  
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .upsert([payload])
    .select()
    .single();

  if (error) {
    console.warn('createAlbumMaster error or DB not connected, saving to localStorage:', error);
  } else if (genresToSave !== undefined) {
    // Delete existing tags before inserting new ones
    await supabase.from('VINYL_TAG').delete().eq('ALBUM_ID', album.ALBUM_ID);
    if (genresToSave.length > 0) {
      const tagsToInsert = genresToSave.map(g => ({
        ALBUM_ID: album.ALBUM_ID,
        TAG_TYPE: 'GENRE',
        TAG_NAME: g
      }));
      await supabase.from('VINYL_TAG').insert(tagsToInsert);
    }
  }
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const local = localStorage.getItem('VINYL_A_LOCAL_MASTERS') || '{}';
    const masters = JSON.parse(local);
    // Always preserve the full album containing MARKET_PRICE, GENRES, TRACKS
    masters[album.ALBUM_ID as number] = { ...(masters[album.ALBUM_ID as number] || {}), ...album };
    localStorage.setItem('VINYL_A_LOCAL_MASTERS', JSON.stringify(masters));
  }

  return error ? (album as ALBUM_MASTER) : (data as ALBUM_MASTER);
};

// =======================
// USER_VINYL CRUD
// =======================

export const getUserVinyls = async (userId: string | number): Promise<any[]> => {
  const { data, error } = await supabase
    .from('USER_VINYL')
    .select('*, ALBUM_MASTER(*, VINYL_TAG(*))')
    .eq('USER_ID', userId);

  if (error || !data || data.length === 0) {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const localV = localStorage.getItem('VINYL_A_LOCAL_COLLECTION');
      const localM = localStorage.getItem('VINYL_A_LOCAL_MASTERS');
      if (localV) {
        const vinyls = JSON.parse(localV);
        const masters = localM ? JSON.parse(localM) : {};
        return vinyls.map((v: any) => ({
          ...v,
          ALBUM_MASTER: masters[v.ALBUM_ID] || null
        }));
      }
    }
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
  // Tags should cascade if DB is set up that way, but let's delete explicitly just in case
  // Wait, VINYL_TAG references USER_VINYL. We can just delete USER_VINYL and it should cascade,
  // or we just delete USER_VINYL by USER_ID.
  const { error } = await supabase
    .from('USER_VINYL')
    .delete()
    .eq('USER_ID', userId);
    
  if (error) {
    console.warn('wipeUserData error:', error);
  }
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem('VINYL_A_LOCAL_COLLECTION');
    localStorage.removeItem('vinyls_dbData');
  }
};

export const upsertUserVinyl = async (userVinyl: Partial<USER_VINYL>): Promise<USER_VINYL | null> => {
  // First, check if the user already has this album
  let existing = null;
  if (userVinyl.USER_ID && userVinyl.ALBUM_ID) {
    const { data } = await supabase
      .from('USER_VINYL')
      .select('*')
      .eq('USER_ID', userVinyl.USER_ID)
      .eq('ALBUM_ID', userVinyl.ALBUM_ID)
      .single();
    existing = data;
  }

  const payload = existing ? { ...existing, ...userVinyl } : userVinyl;

  const { data, error } = await supabase
    .from('USER_VINYL')
    .upsert([payload])
    .select()
    .single();

  if (error) {
    console.warn('upsertUserVinyl error or DB not connected, saving to localStorage:', error);
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
    return userVinyl as USER_VINYL;
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
    return false;
  }
  return true;
};

export const deleteUserVinylByAlbum = async (userId: string | number, albumId: number): Promise<boolean> => {
  const { error } = await supabase
    .from('USER_VINYL')
    .delete()
    .eq('USER_ID', userId)
    .eq('ALBUM_ID', albumId);

  if (error) {
    // Also remove from localStorage if DB fails
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const local = localStorage.getItem('VINYL_A_LOCAL_COLLECTION');
      if (local) {
        const arr = JSON.parse(local).filter((v: any) => v.ALBUM_ID !== albumId);
        localStorage.setItem('VINYL_A_LOCAL_COLLECTION', JSON.stringify(arr));
        return true; // Consider it a success locally
      }
    }
    return false;
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
