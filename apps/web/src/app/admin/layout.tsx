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
  { name: '문의 관리', path: '/admin/inquiries' },
];

const PERIODS = [7, 30, 90];

const PeriodFilter = () => {
  const { days, setDays } = useAdminStats();
  return (
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
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
              <PeriodFilter />
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
