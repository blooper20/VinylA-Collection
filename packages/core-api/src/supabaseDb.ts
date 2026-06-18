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
    console.error('getUserVinyls error:', error);
    return [];
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
