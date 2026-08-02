'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@vinyla/core-api';
import { compareValues, SortDir } from '../../../utils/tableSort';
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
  countryCode: string | null;
}

// ISO 3166-1 alpha-2 코드 → 국기 이모지 (regional indicator 유니코드 연산,
// 라이브러리 불필요).
const flagEmoji = (code: string | null): string => {
  if (!code || code.length !== 2) return '🏳️';
  const base = 0x1f1e6; // regional indicator 'A'
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => base + (c.charCodeAt(0) - 65))
  );
};

const countryName = (code: string | null): string => {
  if (!code) return '알 수 없음';
  try {
    return new Intl.DisplayNames(['ko'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};

// 가입일/최근 로그인 — 초 단위까지 표시. auth.users.created_at과
// last_sign_in_at은 Supabase Auth가 로그인마다 자동으로 갱신하는 timestamptz라
// 원본 데이터는 이미 초 단위 정밀도를 갖고 있었다(표시만 날짜로 잘려 있었음).
const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ko-KR', {
        year: '2-digit', month: 'numeric', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      })
    : '—';

type SortKey = 'displayName' | 'createdAt' | 'provider' | 'countryCode' | 'owned' | 'wish' | 'lastSignInAt' | 'deleted';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'displayName', label: '사용자' },
  { key: 'createdAt', label: '가입' },
  { key: 'provider', label: '수단' },
  { key: 'countryCode', label: '국가' },
  { key: 'owned', label: '보유' },
  { key: 'wish', label: '위시' },
  { key: 'lastSignInAt', label: '최근 로그인' },
  { key: 'deleted', label: '상태' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
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

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => compareValues(a[sortKey], b[sortKey]) * (sortDir === 'asc' ? 1 : -1));
    return rows;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

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
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={styles.sortableHeader}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className={styles.sortArrow}>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
              <th>프로필</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className={styles.placeholder}>불러오는 중...</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.placeholder}>
                  {query ? '검색 결과가 없습니다' : '사용자가 없습니다'}
                </td>
              </tr>
            ) : (
              sorted.map((u) => (
                <tr key={u.id} className={u.deleted ? styles.rowDeleted : undefined}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{u.displayName || '(이름 없음)'}</span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                  </td>
                  <td className={styles.num}>{formatDate(u.createdAt)}</td>
                  <td>{u.provider}</td>
                  <td title={countryName(u.countryCode)}>
                    <span className={styles.countryCell}>
                      {flagEmoji(u.countryCode)} {u.countryCode || '-'}
                    </span>
                  </td>
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
