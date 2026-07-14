import { supabase } from './supabase';
import { AppError } from './errors';
import { FeedItem } from './feed';

export interface VinylComment {
  COMMENT_ID: number;
  USER_VINYL_ID: number;
  USER_ID: string;
  CONTENT: string;
  PARENT_COMMENT_ID: number | null;
  IS_HIDDEN: boolean;
  CREATED_AT: string;
  DISPLAY_NAME: string | null;
  PROFILE_IMAGE_URL: string | null;
  REPLIES?: VinylComment[];
}

export interface VinylSocialSummary {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
}

const getDisplayNameMap = async (userIds: string[]) => {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return {};
  const { data } = await supabase.from('PROFILES').select('USER_ID, DISPLAY_NAME, PROFILE_IMAGE_URL').in('USER_ID', unique);
  const map: Record<string, { name: string | null; img: string | null }> = {};
  for (const r of (data as any[]) || []) {
    map[r.USER_ID] = { name: r.DISPLAY_NAME, img: r.PROFILE_IMAGE_URL };
  }
  return map;
};

export const getVinylComments = async (userVinylId: number): Promise<VinylComment[]> => {
  const { data, error } = await supabase
    .from('VINYL_COMMENT')
    .select('*')
    .eq('USER_VINYL_ID', userVinylId)
    .order('CREATED_AT', { ascending: true });
    
  if (error) throw new AppError('DB-003', '댓글을 불러오는 데 실패했습니다.', error);
  
  const rows = (data as any[]) || [];
  const uids = rows.map((r) => r.USER_ID);
  const profiles = await getDisplayNameMap(uids);
  
  const comments: VinylComment[] = rows.map((r) => ({
    ...r,
    DISPLAY_NAME: profiles[r.USER_ID]?.name || null,
    PROFILE_IMAGE_URL: profiles[r.USER_ID]?.img || null,
    REPLIES: [],
  }));
  
  const parents = comments.filter((c) => !c.PARENT_COMMENT_ID);
  const children = comments.filter((c) => c.PARENT_COMMENT_ID);
  
  children.forEach((child) => {
    const parent = parents.find((p) => p.COMMENT_ID === child.PARENT_COMMENT_ID);
    if (parent) parent.REPLIES!.push(child);
  });
  
  return parents;
};

export const addVinylComment = async (
  userVinylId: number,
  content: string,
  parentId?: number
) => {
  const { data, error } = await supabase
    .from('VINYL_COMMENT')
    .insert({
      USER_VINYL_ID: userVinylId,
      CONTENT: content,
      PARENT_COMMENT_ID: parentId || null,
    })
    .select()
    .single();
    
  if (error) throw new AppError('DB-003', '댓글 작성에 실패했습니다.', error);
  return data;
};

export const deleteVinylComment = async (commentId: number) => {
  const { error } = await supabase.from('VINYL_COMMENT').delete().eq('COMMENT_ID', commentId);
  if (error) throw new AppError('DB-003', '댓글 삭제에 실패했습니다.', error);
};

export const toggleVinylLike = async (userVinylId: number, isLiked: boolean) => {
  if (isLiked) {
    const { error } = await supabase.from('VINYL_LIKE').delete().eq('USER_VINYL_ID', userVinylId);
    if (error) throw new AppError('DB-003', '좋아요 취소에 실패했습니다.', error);
  } else {
    const { error } = await supabase.from('VINYL_LIKE').insert({ USER_VINYL_ID: userVinylId });
    if (error) throw new AppError('DB-003', '좋아요에 실패했습니다.', error);
  }
};

export const getVinylLikeCount = async (userVinylId: number): Promise<{ count: number; isLiked: boolean }> => {
  const { data: countData, error: countErr } = await supabase
    .from('VINYL_LIKE')
    .select('*', { count: 'exact', head: true })
    .eq('USER_VINYL_ID', userVinylId);

  const { data: userData } = await supabase.auth.getSession();
  const userId = userData?.session?.user?.id;

  let isLiked = false;
  if (userId) {
    const { data: myLike } = await supabase
      .from('VINYL_LIKE')
      .select('LIKE_ID')
      .eq('USER_VINYL_ID', userVinylId)
      .eq('USER_ID', userId)
      .maybeSingle();
    if (myLike) isLiked = true;
  }

  return { count: countData !== null ? (countData as unknown as number) : 0, isLiked };
};

export const toggleVinylSave = async (userVinylId: number, isSaved: boolean) => {
  if (isSaved) {
    const { error } = await supabase.from('SAVED_VINYL_POST').delete().eq('USER_VINYL_ID', userVinylId);
    if (error) throw new AppError('DB-003', '저장 취소에 실패했습니다.', error);
  } else {
    const { error } = await supabase.from('SAVED_VINYL_POST').insert({ USER_VINYL_ID: userVinylId });
    if (error) throw new AppError('DB-003', '저장에 실패했습니다.', error);
  }
};

export const checkIsVinylSaved = async (userVinylId: number): Promise<boolean> => {
  const { data: userData } = await supabase.auth.getSession();
  const userId = userData?.session?.user?.id;
  if (!userId) return false;
  
  const { data } = await supabase
    .from('SAVED_VINYL_POST')
    .select('SAVE_ID')
    .eq('USER_VINYL_ID', userVinylId)
    .eq('USER_ID', userId)
    .maybeSingle();
    
  return !!data;
};

export const reportVinyl = async (userVinylId: number, reason: string, details?: string) => {
  const { error } = await supabase.from('VINYL_REPORT').insert({
    USER_VINYL_ID: userVinylId,
    REASON: reason,
    DETAILS: details || null
  });
  if (error) throw new AppError('DB-003', '신고 접수에 실패했습니다.', error);
};

export const reportVinylComment = async (commentId: number, reason: string, details?: string) => {
  const { error } = await supabase.from('VINYL_COMMENT_REPORT').insert({
    COMMENT_ID: commentId,
    REASON: reason,
    DETAILS: details || null
  });
  if (error) throw new AppError('DB-003', '댓글 신고 접수에 실패했습니다.', error);
};

export const getVinylSocialSummary = async (userVinylIds: number[]): Promise<Record<number, VinylSocialSummary>> => {
  if (userVinylIds.length === 0) return {};
  
  const { data: userData } = await supabase.auth.getSession();
  const userId = userData?.session?.user?.id;

  const [
    { data: likes },
    { data: comments },
    myLikesRes,
    mySavesRes
  ] = await Promise.all([
    supabase.from('VINYL_LIKE').select('USER_VINYL_ID').in('USER_VINYL_ID', userVinylIds),
    supabase.from('VINYL_COMMENT').select('USER_VINYL_ID').in('USER_VINYL_ID', userVinylIds),
    userId ? supabase.from('VINYL_LIKE').select('USER_VINYL_ID').in('USER_VINYL_ID', userVinylIds).eq('USER_ID', userId) : Promise.resolve({ data: [] }),
    userId ? supabase.from('SAVED_VINYL_POST').select('USER_VINYL_ID').in('USER_VINYL_ID', userVinylIds).eq('USER_ID', userId) : Promise.resolve({ data: [] }),
  ]);

  const map: Record<number, VinylSocialSummary> = {};
  for (const id of userVinylIds) {
    map[id] = { likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false };
  }

  for (const l of (likes || [])) {
    if (map[l.USER_VINYL_ID]) map[l.USER_VINYL_ID].likeCount++;
  }
  for (const c of (comments || [])) {
    if (map[c.USER_VINYL_ID]) map[c.USER_VINYL_ID].commentCount++;
  }
  for (const ml of (myLikesRes?.data || [])) {
    if (map[ml.USER_VINYL_ID]) map[ml.USER_VINYL_ID].likedByMe = true;
  }
  for (const ms of (mySavesRes?.data || [])) {
    if (map[ms.USER_VINYL_ID]) map[ms.USER_VINYL_ID].savedByMe = true;
  }

  return map;
};
