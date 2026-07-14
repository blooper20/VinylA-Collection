'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getFollowList,
  FollowListEntry,
  getIncomingFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  FollowRequestEntry,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

export type FollowListTab = 'followers' | 'following' | 'requests';

interface FollowListModalProps {
  userId: string;
  initialTab: FollowListTab;
  onClose: () => void;
  /** 본인 목록 여부 — true면 "요청" 탭(수락/거절)이 활성화된다 */
  isOwner?: boolean;
  /** true면 목록 대신 비공개 안내를 보여준다 (비공개 프로필을 제3자가 볼 때) */
  listsHidden?: boolean;
  /** 요청 수락 시 팔로워 카운트 갱신 등 후처리 */
  onFollowerAccepted?: () => void;
}

// 팔로워/팔로잉/요청 목록 모달 — /my, /user/[id], /user/[id]/dashboard 공용.
// 목록 접근 제어는 get_follow_list RPC(본인/관리자/공개 프로필)가 담당한다.
export const FollowListModal: React.FC<FollowListModalProps> = ({
  userId,
  initialTab,
  onClose,
  isOwner = false,
  listsHidden = false,
  onFollowerAccepted,
}) => {
  const { t } = useLocale();
  const [tab, setTab] = useState<FollowListTab>(initialTab);
  const [lists, setLists] = useState<Record<'followers' | 'following', FollowListEntry[] | null>>({
    followers: null,
    following: null,
  });
  const [requests, setRequests] = useState<FollowRequestEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (tab === 'requests') {
      if (requests === null && isOwner) {
        getIncomingFollowRequests().then((rows) => {
          if (!cancelled) setRequests(rows);
        });
      }
      return () => { cancelled = true; };
    }
    if (lists[tab] === null && !listsHidden) {
      getFollowList(userId, tab).then((entries) => {
        if (!cancelled) setLists((prev) => ({ ...prev, [tab]: entries }));
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId, listsHidden, isOwner]);

  const handleAccept = async (requesterId: string) => {
    setRequests((prev) => (prev || []).filter((r) => r.USER_ID !== requesterId));
    try {
      await acceptFollowRequest(requesterId);
      // 팔로워 목록은 다음 열람 때 새로 불러오도록 캐시 무효화
      setLists((prev) => ({ ...prev, followers: null }));
      onFollowerAccepted?.();
    } catch {
      setRequests(null); // 실패 시 재조회 유도
    }
  };

  const handleReject = async (requesterId: string) => {
    setRequests((prev) => (prev || []).filter((r) => r.USER_ID !== requesterId));
    try {
      await rejectFollowRequest(requesterId);
    } catch {
      setRequests(null);
    }
  };

  // 컬렉션 공유 페이지(/user/[id])가 아니라 프로필 대시보드로 보낸다
  const profileHref = (id: string, name: string | null) =>
    `/user/${id}/dashboard${name ? `?n=${encodeURIComponent(name)}` : ''}`;

  const tabs: FollowListTab[] = isOwner
    ? ['followers', 'following', 'requests']
    : ['followers', 'following'];

  const tabLabel = (k: FollowListTab) =>
    k === 'followers'
      ? t('publicGrid.followers')
      : k === 'following'
        ? t('publicGrid.following')
        : `${t('publicGrid.requestsTab')}${requests && requests.length > 0 ? ` ${requests.length}` : ''}`;

  const emptyText = (message: string) => (
    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '32px 16px' }}>
      {message}
    </p>
  );

  const avatarCircle = (name: string) => (
    <span style={{
      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
      background: 'rgba(212,175,55,0.18)', color: '#d4af37',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '15px', fontWeight: 700
    }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );

  const entries = tab === 'requests' ? null : lists[tab as 'followers' | 'following'];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(8px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1814',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          width: '380px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {tabs.map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                flex: 1, padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 700,
                color: tab === k ? '#d4af37' : 'rgba(255,255,255,0.45)',
                borderBottom: tab === k ? '2px solid #d4af37' : '2px solid transparent',
                transition: 'color 0.15s ease'
              }}
            >
              {tabLabel(k)}
            </button>
          ))}
          <button
            onClick={onClose}
            aria-label="close"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0 14px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {tab === 'requests' ? (
            requests === null ? (
              emptyText(t('feed.loading'))
            ) : requests.length === 0 ? (
              emptyText(t('publicGrid.followListEmpty'))
            ) : (
              requests.map((r) => {
                const name = r.DISPLAY_NAME || t('feed.anonymous');
                return (
                  <div key={r.USER_ID} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px' }}>
                    {avatarCircle(name)}
                    <Link
                      href={profileHref(r.USER_ID, r.DISPLAY_NAME)}
                      onClick={onClose}
                      style={{ color: '#fff', fontSize: '14px', fontWeight: 600, textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {name}
                    </Link>
                    <button
                      onClick={() => handleAccept(r.USER_ID)}
                      style={{
                        padding: '6px 14px', borderRadius: '999px', border: '1px solid #d4af37',
                        background: 'linear-gradient(135deg, #d4af37, #f3e5ab)', color: '#111',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {t('publicGrid.accept')}
                    </button>
                    <button
                      onClick={() => handleReject(r.USER_ID)}
                      style={{
                        padding: '6px 14px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.25)',
                        background: 'transparent', color: 'rgba(255,255,255,0.6)',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {t('publicGrid.reject')}
                    </button>
                  </div>
                );
              })
            )
          ) : listsHidden ? (
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#d4af37', fontVariationSettings: "'FILL' 1" }}>lock</span>
              {emptyText(t('publicGrid.followListPrivate'))}
            </div>
          ) : entries === null ? (
            emptyText(t('feed.loading'))
          ) : entries.length === 0 ? (
            emptyText(t('publicGrid.followListEmpty'))
          ) : (
            entries.map((e) => {
              const name = e.DISPLAY_NAME || t('feed.anonymous');
              return (
                <Link
                  key={e.USER_ID}
                  href={profileHref(e.USER_ID, e.DISPLAY_NAME)}
                  onClick={onClose}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', textDecoration: 'none' }}
                >
                  {avatarCircle(name)}
                  <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
