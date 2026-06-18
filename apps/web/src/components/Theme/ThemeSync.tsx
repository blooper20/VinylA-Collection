"use client";
import { useTheme } from '@vinyla/ui';
import { useEffect } from 'react';

export const ThemeSync = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
};
