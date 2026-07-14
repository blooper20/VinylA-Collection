import { supabase } from './supabase';
import { VINYL_STORY } from '@vinyla/shared-types';
import { getProxyBaseUrl } from './externalApi';
import { AppError } from './errors';

// 오늘의 바이닐 스토리 — 생성(Gemini 호출)은 GEMINI_API_KEY가 필요한 서버
// 라우트(/api/vinyl-story/today)만 할 수 있어 fetch로 감싼다. 지난 스토리는
// 생성이 필요 없는 단순 공개 읽기라 Supabase에 직접 질의한다.

export const getTodayVinylStory = async (): Promise<VINYL_STORY | null> => {
  const res = await fetch(`${getProxyBaseUrl()}/api/vinyl-story/today`);
  if (!res.ok) {
    throw new AppError('EXT-004', '오늘의 스토리를 불러오지 못했습니다.');
  }
  const body = await res.json();
  return body.story || null;
};

export const getVinylStoryArchive = async (limit: number = 10): Promise<VINYL_STORY[]> => {
  const { data, error } = await supabase
    .from('VINYL_STORY')
    .select('*')
    .order('STORY_DATE', { ascending: false })
    .limit(limit + 1); // 오늘 것도 포함해서 오길래 +1, 호출부에서 오늘 것 제외

  if (error) return [];
  return (data as VINYL_STORY[]) || [];
};
