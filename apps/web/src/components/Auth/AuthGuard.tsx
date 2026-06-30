'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@vinyla/core-api';
import styles from './AuthGuard.module.css';

const PUBLIC_ROUTES = ['/', '/login'];

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, initializeAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    // Only initialize once on mount
    if (!hasInitialized) {
      initializeAuth().then(() => setHasInitialized(true));
    }
  }, [initializeAuth, hasInitialized]);

  useEffect(() => {
    if (!hasInitialized || isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    if (!user && !isPublicRoute) {
      // 비로그인 (또는 del_yn === 'N'으로 인해 로그아웃된) 유저가 보호된 라우트 접근 시 메인(랜딩)으로 강제 이동
      router.replace('/');
    } else if (user && isPublicRoute) {
      // 로그인된 정상 유저가 랜딩 페이지나 로그인 페이지에 접근 시 보관함으로 자동 이동
      router.replace('/collection');
    }
  }, [user, isLoading, pathname, router, hasInitialized]);

  if (!hasInitialized || isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  // 랜딩 중일 때 잠깐 번쩍이는 것을 막기 위해 추가 방어
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  if (!user && !isPublicRoute) {
    return null; // 리다이렉트 전 렌더링 방지
  }

  if (user && isPublicRoute) {
    return null; // 리다이렉트 전 렌더링 방지
  }

  return <>{children}</>;
};
