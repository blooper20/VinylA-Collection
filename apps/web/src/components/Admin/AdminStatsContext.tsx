'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@vinyla/core-api';

export interface StatsPayload {
  days: number;
  kpis: {
    totalUsers: number;
    deletedUsers: number;
    newUsers: number;
    newUsersDelta: number;
    ownedCount: number;
    wishCount: number;
    openInquiries: number;
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
    dormantUsers: number;
    assetPurchaseTotal: number;
    assetMarketTotal: number;
  };
  funnel: { signedUp: number; profileDone: number; firstAlbum: number };
  conversion: {
    searches: number;
    adds: number;
    searchToAdd: number | null;
    wishAdds: number;
    wishConverted: number;
    wishToOwned: number | null;
  };
  acquisition: {
    visits: number;
    signups: number;
    visitToSignup: number | null;
    visitsBySource: { label: string; count: number }[];
    signupsBySource: { label: string; count: number }[];
    signupsByProvider: { label: string; count: number }[];
    shareVisits: number;
    shareSignups: number;
  };
  scanStats: {
    total: number;
    successRate: number | null;
    series: { date: string; success: number; fail: number; rate: number | null }[];
    errorTypes: { label: string; count: number }[];
  };
  signupTrend: { date: string; count: number }[];
  dauTrend: { date: string; count: number }[];
  eventTypes: string[];
  eventSeries: Record<string, number | string>[];
  heatmap: { dow: number; hour: number; count: number }[];
  retentionCohorts: { cohort: string; size: number; weeks: (number | null)[] }[];
  genreDist: { genre: string; count: number }[];
  collectionHistogram: { bucket: string; users: number }[];
  topAlbums: { albumId: number; title: string; artist: string; image: string; users: number }[];
  topArtists: { artist: string; count: number }[];
  inquiryOps: {
    total: number;
    avgFirstReplyHours: number | null;
    oldestOpenDays: number;
    categories: { category: string; count: number }[];
  };
}

interface AdminStatsValue {
  stats: StatsPayload | null;
  days: number;
  setDays: (d: number) => void;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const AdminStatsCtx = createContext<AdminStatsValue | null>(null);

export const useAdminStats = (): AdminStatsValue => {
  const value = useContext(AdminStatsCtx);
  if (!value) throw new Error('useAdminStats must be used within AdminStatsProvider');
  return value;
};

// 탭을 오갈 때마다 무거운 stats 집계를 다시 호출하지 않도록,
// admin 레이아웃에서 한 번만 로드해 모든 탭이 공유한다.
export const AdminStatsProvider = ({ children }: { children: React.ReactNode }) => {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (period: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('세션이 없습니다');

      const res = await fetch(`/api/admin/stats?days=${period}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `요청 실패 (${res.status})`);
      }
      setStats(await res.json());
    } catch (e: any) {
      console.error('Failed to load stats', e);
      setError(e?.message || '통계를 불러오지 못했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats(days);
  }, [days, loadStats]);

  return (
    <AdminStatsCtx.Provider
      value={{ stats, days, setDays, isLoading, error, reload: () => loadStats(days) }}
    >
      {children}
    </AdminStatsCtx.Provider>
  );
};
