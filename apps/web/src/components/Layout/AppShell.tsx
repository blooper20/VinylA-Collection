'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SideNav } from '../Navigation/SideNav';

// Public, chrome-free routes: the landing/auth pages, and shared profile
// links (/user/[id], /user/[id]/dashboard) which are opened cold — often on
// a phone — by people who aren't logged in and shouldn't see the
// authenticated app's sidebar (with links that would just bounce them to
// /unauthorized) or its 80px reserved gutter.
const isChromeFreeRoute = (pathname: string) =>
  pathname === '/' || pathname === '/login' || pathname === '/unauthorized' || pathname.startsWith('/user/');

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  if (isChromeFreeRoute(pathname)) {
    return <main className="main-content main-content--full">{children}</main>;
  }

  return (
    <div className="layout-shell">
      <SideNav />
      <main className="main-content">{children}</main>
    </div>
  );
};
