'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '../../components/Auth/AdminGuard';
import styles from './admin.module.css';

const tabs = [
  { name: '대시보드', path: '/admin' },
  { name: '문의 관리', path: '/admin/inquiries' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>ADMIN CONSOLE</p>
          <h1 className={styles.title}>관리자</h1>
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
    </AdminGuard>
  );
}
