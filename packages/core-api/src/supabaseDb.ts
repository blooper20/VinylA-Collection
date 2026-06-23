import { supabase } from './supabase';
import { ALBUM_MASTER, USER_VINYL, VINYL_TAG } from '@vinyla/shared-types';

// =======================
// ALBUM_MASTER CRUD
// =======================

export const getAlbumMaster = async (albumId: number): Promise<ALBUM_MASTER | null> => {
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .select('*')
    .eq('ALBUM_ID', albumId)
    .single();

  if (error) {
    console.error('getAlbumMaster error:', error);
    return null;
  }
  return data as ALBUM_MASTER;
};

export const createAlbumMaster = async (album: Partial<ALBUM_MASTER>): Promise<ALBUM_MASTER | null> => {
  const { data, error } = await supabase
    .from('ALBUM_MASTER')
    .insert([album])
    .select()
    .single();

  if (error) {
    console.error('createAlbumMaster error:', error);
    return null;
  }
  return data as ALBUM_MASTER;
};

// =======================
// USER_VINYL CRUD
// =======================

export const getUserVinyls = async (userId: number): Promise<USER_VINYL[]> => {
  const { data, error } = await supabase
    .from('USER_VINYL')
    .select('*')
    .eq('USER_ID', userId);

  if (error) {
    console.warn('getUserVinyls error or DB not connected, returning mock data:', error);
    return [
      { USER_VINYL_ID: 1, USER_ID: userId, ALBUM_ID: 1, STATUS: 'OWNED', PURCHASE_PRICE: 50000, ADDED_AT: new Date().toISOString() } as any,
    ];
  }
  
  if (!data || data.length === 0) {
    return [
      { USER_VINYL_ID: 1, USER_ID: userId, ALBUM_ID: 1, STATUS: 'OWNED', PURCHASE_PRICE: 50000, ADDED_AT: new Date().toISOString() } as any,
    ];
  }

  return data as USER_VINYL[];
};

export const upsertUserVinyl = async (userVinyl: Partial<USER_VINYL>): Promise<USER_VINYL | null> => {
  const { data, error } = await supabase
    .from('USER_VINYL')
    .upsert([userVinyl])
    .select()
    .single();

  if (error) {
    console.error('upsertUserVinyl error:', error);
    return null;
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

export const mapToFrontendModel = (userVinyl: any, albumMaster: any) => {
  return {
    ALBUM_ID: albumMaster?.ALBUM_ID || userVinyl?.ALBUM_ID,
    TITLE: albumMaster?.TITLE || 'Unknown Title',
    ARTIST: albumMaster?.ARTIST || 'Unknown Artist',
    COVER_URL: albumMaster?.COVER_IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    IMAGE_URL: albumMaster?.COVER_IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
    RELEASE_YEAR: albumMaster?.RELEASE_YEAR || 2024,
    GENRES: ['Jazz'], // fallback
    STATUS: userVinyl?.STATUS || 'WISH',
    PURCHASE_PRICE: userVinyl?.PURCHASE_PRICE,
    CUSTOM_COLOR_HEX: '#1a1c1c'
  };
};
