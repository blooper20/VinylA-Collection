import { supabase } from './supabase';

// 알림함 — NOTIFICATION 테이블은 DB 트리거만 적재(클라이언트 INSERT 정책
// 없음)하고, RLS가 수신자 본인만 조회/읽음처리/삭제할 수 있게 한다.
// Realtime publication에 등록돼 있어 미읽음 배지를 실시간 갱신할 수 있다.

export type NotificationType =
  | 'SPIN_LIKE' | 'SPIN_COMMENT' | 'SPIN_REPLY'
  | 'VINYL_LIKE' | 'VINYL_COMMENT' | 'VINYL_REPLY'
  | 'FOLLOW_REQUEST' | 'FOLLOW_ACCEPTED' | 'NEW_FOLLOWER'
  | 'NOTICE';

export interface NotificationItem {
  NOTIFICATION_ID: number;
  TYPE: NotificationType;
  ACTOR_ID: string | null;
  ACTOR_NAME: string | null;
  LOG_ID: number | null;
  USER_VINYL_ID: number | null;
  COMMENT_PREVIEW: string | null;
  /** TYPE === 'NOTICE'일 때만 채워짐 — 상세 화면 이동/제목 표시용 */
  NOTICE_ID: number | null;
  NOTICE_TITLE: string | null;
  READ_AT: string | null;
  CREATED_AT: string;
}

export const getNotifications = async (
  { limit = 30, before }: { limit?: number; before?: string } = {}
): Promise<NotificationItem[]> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return [];

  let query = supabase
    .from('NOTIFICATION')
    .select('NOTIFICATION_ID, TYPE, ACTOR_ID, LOG_ID, USER_VINYL_ID, COMMENT_PREVIEW, NOTICE_ID, READ_AT, CREATED_AT')
    .order('CREATED_AT', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('CREATED_AT', before);

  const { data, error } = await query;
  if (error || !data) return [];

  const rows = data as any[];
  const actorIds = [...new Set(rows.map((r) => r.ACTOR_ID).filter(Boolean))] as string[];
  const noticeIds = [...new Set(rows.map((r) => r.NOTICE_ID).filter(Boolean))] as number[];
  const nameMap: Record<string, string> = {};
  const noticeTitleMap: Record<number, string> = {};
  const [profilesRes, noticesRes] = await Promise.all([
    actorIds.length > 0
      ? supabase.from('PROFILES').select('USER_ID, DISPLAY_NAME').in('USER_ID', actorIds)
      : Promise.resolve({ data: null }),
    noticeIds.length > 0
      ? supabase.from('NOTICE').select('NOTICE_ID, TITLE').in('NOTICE_ID', noticeIds)
      : Promise.resolve({ data: null }),
  ]);
  for (const p of (profilesRes.data as { USER_ID: string; DISPLAY_NAME: string | null }[]) || []) {
    if (p.DISPLAY_NAME) nameMap[p.USER_ID] = p.DISPLAY_NAME;
  }
  for (const n of (noticesRes.data as { NOTICE_ID: number; TITLE: string }[]) || []) {
    noticeTitleMap[n.NOTICE_ID] = n.TITLE;
  }
  return rows.map((r) => ({
    ...r,
    ACTOR_NAME: r.ACTOR_ID ? nameMap[r.ACTOR_ID] || null : null,
    NOTICE_TITLE: r.NOTICE_ID ? noticeTitleMap[r.NOTICE_ID] || null : null,
  }));
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return 0;
  const { count, error } = await supabase
    .from('NOTIFICATION')
    .select('NOTIFICATION_ID', { count: 'exact', head: true })
    .is('READ_AT', null);
  return error ? 0 : count || 0;
};

/** 알림함을 열면 전체 읽음 처리 (RLS: 본인 행만 UPDATE 가능) */
export const markAllNotificationsRead = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;
  await supabase
    .from('NOTIFICATION')
    .update({ READ_AT: new Date().toISOString() })
    .is('READ_AT', null);
};

/**
 * 새 알림 실시간 구독 — 미읽음 배지 갱신용. RLS(WALRUS)가 수신자 본인
 * 이벤트만 전달한다. 반환값은 해제 함수.
 */
export const subscribeToNotifications = (onNew: () => void): (() => void) => {
  const channel = supabase
    .channel('my-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'NOTIFICATION' },
      () => onNew()
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
};
