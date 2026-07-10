'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '../../components/Auth/AdminGuard';
import { AdminStatsProvider, useAdminStats } from '../../components/Admin/AdminStatsContext';
import styles from './admin.module.css';

const tabs = [
  { name: '개요', path: '/admin' },
  { name: '유입', path: '/admin/acquisition' },
  { name: '성장', path: '/admin/growth' },
  { name: '사용', path: '/admin/engagement' },
  { name: '컬렉션', path: '/admin/collection' },
  { name: '사용자', path: '/admin/users' },
  { name: '문의 관리', path: '/admin/inquiries' },
];

// 기간 필터·새로고침은 stats 기반 탭에서만 의미가 있다 (사용자/문의는 자체 조회)
const STATS_PATHS = new Set(['/admin', '/admin/acquisition', '/admin/growth', '/admin/engagement', '/admin/collection']);

const PERIODS = [7, 30, 90];

const StatsToolbar = () => {
  const { days, setDays, isLoading, lastUpdated, reload } = useAdminStats();
  return (
    <div className={styles.toolbar}>
      <div className={styles.filterRow}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.periodBtn} ${days === p ? styles.periodActive : ''}`}
            onClick={() => setDays(p)}
          >
            최근 {p}일
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.refreshBtn}
        onClick={reload}
        disabled={isLoading}
        title="데이터 새로고침"
      >
        {isLoading
          ? '불러오는 중…'
          : `↻ ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) + ' 기준' : '새로고침'}`}
      </button>
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStatsTab = STATS_PATHS.has(pathname);

  return (
    <AdminGuard>
      <AdminStatsProvider>
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <div>
                <p className={styles.eyebrow}>ADMIN CONSOLE</p>
                <h1 className={styles.title}>관리자</h1>
              </div>
              {isStatsTab && <StatsToolbar />}
            </div>
            <nav className={styles.tabs}>
              {tabs.map((tab) => (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`${styles.tab} ${pathname === tab.path ? styles.tabActive : ''}`}
                >
                  {tab.name}
                </Link>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </AdminStatsProvider>
    </AdminGuard>
  );
}
