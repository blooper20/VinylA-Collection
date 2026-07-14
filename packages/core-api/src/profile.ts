import { supabase } from './supabase';
import { AppError } from './errors';

// 프로필 공개/비공개 설정. 실제 차단은 DB(RLS)가 담당한다 —
// USER_VINYL 읽기 정책이 is_profile_public()을 검사하므로 비공개 유저의
// 컬렉션은 본인·관리자 외에는 조회/Realtime 수신이 안 된다. 여기의
// 조회 함수는 UI 안내(잠금 화면·토글 상태) 용도다.

export interface ProfileInfo {
  DISPLAY_NAME: string | null;
  /** 명시적으로 공개(IS_PUBLIC=true)한 경우만 true — 행이 없으면 비공개 (opt-in, RLS의 is_profile_public()과 동일 규칙) */
  IS_PUBLIC: boolean;
}

export const getProfileInfo = async (userId: string): Promise<ProfileInfo> => {
  const { data } = await supabase
    .from('PROFILES')
    .select('DISPLAY_NAME, IS_PUBLIC')
    .eq('USER_ID', userId)
    .maybeSingle();
  return {
    DISPLAY_NAME: (data as any)?.DISPLAY_NAME ?? null,
    IS_PUBLIC: (data as any)?.IS_PUBLIC === true,
  };
};

export const setMyProfileVisibility = async (isPublic: boolean): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new AppError('DB-001', '로그인이 필요합니다.');

  // upsert가 아니라 UPDATE 우선 — 라이브 DB의 DISPLAY_NAME이 NOT NULL이라
  // 닉네임 없는 upsert INSERT 경로는 23502로 터진다. UPDATE는 IS_PUBLIC만
  // 건드리므로 닉네임 쿨다운 트리거와도 무관하다.
  const { data: updated, error } = await supabase
    .from('PROFILES')
    .update({ IS_PUBLIC: isPublic })
    .eq('USER_ID', userId)
    .select('USER_ID');
  if (error) {
    throw new AppError('DB-001', '프로필 공개 설정 변경에 실패했습니다.', error);
  }
  if (updated && updated.length > 0) return;

  // 프로필 행이 없는 계정(닉네임 미설정) — user_metadata 닉네임으로 생성.
  // 그래도 없으면 유니크한 폴백 닉네임을 만든다 (DISPLAY_NAME UNIQUE 대비).
  const displayName =
    session!.user.user_metadata?.displayName || `Collector-${userId.slice(0, 8)}`;
  const { error: insertError } = await supabase
    .from('PROFILES')
    .insert({ USER_ID: userId, DISPLAY_NAME: displayName, IS_PUBLIC: isPublic });
  if (insertError) {
    throw new AppError('DB-001', '프로필 공개 설정 변경에 실패했습니다.', insertError);
  }
};
