'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './notifications.module.css';
import DeleteAllNotificationsModal from '../../components/Modal/DeleteAllNotificationsModal';
import {
  useAuthStore,
  getNotifications,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  NotificationItem,
  NotificationType,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

const PAGE_SIZE = 30;
const SWIPE_OPEN_X = -76;

const TYPE_ICON: Record<NotificationType, string> = {
  SPIN_LIKE: 'favorite',
  SPIN_COMMENT: 'chat_bubble',
  SPIN_REPLY: 'reply',
  VINYL_LIKE: 'favorite',
  VINYL_COMMENT: 'chat_bubble',
  VINYL_REPLY: 'reply',
  FOLLOW_REQUEST: 'person_add',
  FOLLOW_ACCEPTED: 'how_to_reg',
  NEW_FOLLOWER: 'person',
  NOTICE: 'campaign',
};

// 행을 왼쪽으로 밀면 뒤에 숨어있던 삭제 버튼이 드러난다 — 드래그 중엔
// Link 클릭(페이지 이동)을 막아야 해서 드래그 여부를 ref로 함께 추적한다.
const NotificationRow: React.FC<{
  href: string;
  isUnread: boolean;
  icon: string;
  body: React.ReactNode;
  time: string;
  deleteLabel: string;
  onDelete: () => void;
}> = ({ href, isUnread, icon, body, time, deleteLabel, onDelete }) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startDragX: number; dragging: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startDragX: dragX, dragging: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st) return;
    const delta = e.clientX - st.startX;
    if (!st.dragging) {
      if (Math.abs(delta) < 6) return;
      st.dragging = true;
      setIsDragging(true);
    }
    setDragX(Math.min(0, Math.max(SWIPE_OPEN_X, st.startDragX + delta)));
  };
  const endDrag = () => {
    const st = dragRef.current;
    if (!st) return;
    if (st.dragging) setDragX((x) => (x < SWIPE_OPEN_X / 2 ? SWIPE_OPEN_X : 0));
    dragRef.current = null;
    setIsDragging(false);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    // 열려있는 상태(또는 방금 드래그한 상태)에서의 탭은 이동이 아니라 닫기로 처리
    if (dragX !== 0) {
      e.preventDefault();
      setDragX(0);
    }
  };

  return (
    <div className={styles.itemRow}>
      <button type="button" className={styles.deleteAction} onClick={onDelete} aria-label={deleteLabel}>
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
      </button>
      <Link
        href={href}
        className={`${styles.item} ${isUnread ? styles.itemUnread : ''}`}
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
      >
        <span className={styles.iconWrap}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </span>
        <div className={styles.body}>{body}</div>
        <span className={styles.time}>{time}</span>
        {isUnread && <span className={styles.unreadDot} />}
      </Link>
    </div>
  );
};

export default function NotificationsPage() {
  const { t } = useLocale();
  const { user, initializeAuth } = useAuthStore();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const rows = await getNotifications({ limit: PAGE_SIZE });
      if (cancelled) return;
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      // 열람과 동시에 전체 읽음 처리 — 목록의 미읽음 강조는 이번 렌더에서 유지
      markAllNotificationsRead();
      // 사이드바 배지 즉시 갱신
      window.dispatchEvent(new CustomEvent('NOTIFICATIONS_READ'));
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleDelete = async (notificationId: number) => {
    setItems((prev) => (prev ? prev.filter((n) => n.NOTIFICATION_ID !== notificationId) : prev));
    await deleteNotification(notificationId);
  };

  const handleDeleteAll = async () => {
    setItems([]);
    setHasMore(false);
    await deleteAllNotifications();
  };

  const loadMore = async () => {
    if (!items || items.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const last = items[items.length - 1];
      const more = await getNotifications({ limit: PAGE_SIZE, before: last.CREATED_AT });
      setItems((prev) => [...(prev || []), ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const relativeTime = useCallback(
    (iso: string): string => {
      const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (m < 1) return t('feed.justNow');
      if (m < 60) return t('feed.minutesAgo', { m });
      const h = Math.floor(m / 60);
      if (h < 24) return t('feed.hoursAgo', { h });
      return t('feed.daysAgo', { d: Math.floor(h / 24) });
    },
    [t]
  );

  // 알림 클릭 시 이동할 곳 — 관련 콘텐츠가 있는 화면으로
  const notifHref = (n: NotificationItem): string => {
    if (n.TYPE === 'NOTICE') return n.NOTICE_ID ? `/notices/${n.NOTICE_ID}` : '/community?tab=NOTICE';
    if (n.TYPE === 'FOLLOW_REQUEST') return '/my';
    if (n.TYPE === 'FOLLOW_ACCEPTED' || n.TYPE === 'NEW_FOLLOWER') {
      return n.ACTOR_ID
        ? `/user/${n.ACTOR_ID}/dashboard${n.ACTOR_NAME ? `?n=${encodeURIComponent(n.ACTOR_NAME)}` : ''}`
        : '/my';
    }
    if (n.TYPE.startsWith('SPIN_')) return '/log';
    return '/feed';
  };

  const message = (n: NotificationItem) => {
    // 공지 알림은 "행위자"가 아니라 공지 제목을 강조한다
    const name = n.TYPE === 'NOTICE' ? (n.NOTICE_TITLE || t('notif.noticeFallbackTitle')) : (n.ACTOR_NAME || t('notif.anonymous'));
    // {{name}} 자리에 유니크 토큰을 넣어 문장을 앞뒤로 나누고, 이름만 강조한다
    const TOKEN = '__NAME__';
    const [before = '', after = ''] = t(`notif.${n.TYPE}` as any, { name: TOKEN }).split(TOKEN);
    return (
      <p className={styles.message}>
        {before}
        <strong>{name}</strong>
        {after}
      </p>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <p className={styles.eyebrow}>{t('notif.eyebrow')}</p>
            <h1 className={styles.title}>{t('notif.title')}</h1>
          </div>
          {!!items && items.length > 0 && (
            <button type="button" className={styles.deleteAllBtn} onClick={() => setIsDeleteAllModalOpen(true)}>
              {t('notif.deleteAll')}
            </button>
          )}
        </div>
        <p className={styles.subtitle}>{t('notif.subtitle')}</p>
      </header>

      {items === null ? (
        <p className={styles.emptyText}>{t('notif.loading')}</p>
      ) : items.length === 0 ? (
        <p className={styles.emptyText}>{t('notif.empty')}</p>
      ) : (
        <>
          <div className={styles.list}>
            {items.map((n) => (
              <NotificationRow
                key={n.NOTIFICATION_ID}
                href={notifHref(n)}
                isUnread={!n.READ_AT}
                icon={TYPE_ICON[n.TYPE] || 'notifications'}
                time={relativeTime(n.CREATED_AT)}
                deleteLabel={t('notif.delete')}
                onDelete={() => handleDelete(n.NOTIFICATION_ID)}
                body={
                  <>
                    {message(n)}
                    {n.COMMENT_PREVIEW && <p className={styles.preview}>“{n.COMMENT_PREVIEW}”</p>}
                  </>
                }
              />
            ))}
          </div>
          {hasMore && (
            <button type="button" className={styles.loadMoreBtn} onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t('notif.loading') : t('notif.loadMore')}
            </button>
          )}
        </>
      )}

      <DeleteAllNotificationsModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
