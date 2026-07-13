'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@vinyla/core-api';
import styles from './users.module.css';

interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  provider: string;
  createdAt: string;
  lastSignInAt: string | null;
  deleted: boolean;
  owned: number;
  wish: number;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '—';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // 프로필 미리보기: 해당 사용자의 공개 프로필(/user/[id] — 마이페이지의
  // '프로필 공유'로 열리는 화면)을 iframe으로 띄운다. 커버 등 사용자가
  // 실제로 보는 상태를 관리자가 눈으로 확인하는 용도.
  const [previewUser, setPreviewUser] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('세션이 없습니다');
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `요청 실패 (${res.status})`);
        }
        const body = await res.json();
        setUsers(body.users || []);
      } catch (e) {
        console.error('Failed to load users', e);
        setError(e instanceof Error ? e.message : '사용자 목록을 불러오지 못했습니다');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  if (error) return <p className={styles.placeholder}>{error}</p>;

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          type="search"
          className={styles.search}
          placeholder="이름 또는 이메일 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={styles.count}>
          {isLoading ? '불러오는 중...' : `${filtered.length.toLocaleString('ko-KR')}명`}
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>사용자</th>
              <th>가입</th>
              <th>수단</th>
              <th>보유</th>
              <th>위시</th>
              <th>최근 로그인</th>
              <th>상태</th>
              <th>프로필</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className={styles.placeholder}>불러오는 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.placeholder}>
                  {query ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className={u.deleted ? styles.rowDeleted : undefined}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{u.displayName || '(이름 없음)'}</span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </td>
                  <td className={styles.num}>{formatDate(u.createdAt)}</td>
                  <td>{u.provider}</td>
                  <td className={styles.num}>{u.owned}</td>
                  <td className={styles.num}>{u.wish}</td>
                  <td className={styles.num}>{formatDate(u.lastSignInAt)}</td>
                  <td>
                    <span className={u.deleted ? styles.chipDeleted : styles.chipActive}>
                      {u.deleted ? '탈퇴' : '활성'}
                    </span>
                  </td>
                  <td>
                    {!u.deleted && (
                      <button
                        type="button"
                        className={styles.profileBtn}
                        onClick={() => setPreviewUser(u)}
                        title="이 사용자의 공개 프로필(공유 화면)을 봅니다"
                      >
                        보기
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewUser && (
        <div className={styles.profileOverlay} onClick={() => setPreviewUser(null)}>
          <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.profileModalHead}>
              <div>
                <strong>{previewUser.displayName || '(이름 없음)'}</strong>
                <span className={styles.profileModalEmail}>{previewUser.email}</span>
              </div>
              <div className={styles.profileModalActions}>
                <a href={`/user/${previewUser.id}`} target="_blank" rel="noopener noreferrer" className={styles.profileNewTab}>
                  새 탭에서 열기 ↗
                </a>
                <button type="button" className={styles.profileClose} onClick={() => setPreviewUser(null)}>
                  ✕
                </button>
              </div>
            </header>
            <iframe
              src={`/user/${previewUser.id}`}
              className={styles.profileFrame}
              title={`${previewUser.displayName} 공개 프로필`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
