'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@vinyla/core-api';
import { StatTile } from '../../components/Admin/StatTile';
import { ChartCard } from '../../components/Admin/ChartCard';
import {
  SignupAreaChart,
  EventMultiLineChart,
  GenreBarChart,
  CollectionHistogram,
} from '../../components/Admin/charts/AdminCharts';
import styles from './dashboard.module.css';

interface StatsPayload {
  days: number;
  kpis: {
    totalUsers: number;
    deletedUsers: number;
    newUsers: number;
    newUsersDelta: number;
    ownedCount: number;
    wishCount: number;
    openInquiries: number;
  };
  signupTrend: { date: string; count: number }[];
  eventTypes: string[];
  eventSeries: Record<string, number | string>[];
  genreDist: { genre: string; count: number }[];
  collectionHistogram: { bucket: string; users: number }[];
}

const PERIODS = [7, 30, 90];

export default function AdminDashboardPage() {
  const router = useRouter();
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

  const hasEvents =
    !!stats && stats.eventSeries.some((row) =>
      stats.eventTypes.some((t) => Number(row[t]) > 0)
    );

  return (
    <div>
      {/* 기간 필터 */}
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

      {error ? (
        <div className={styles.errorBox}>
          <p>{error}</p>
          <button type="button" onClick={() => loadStats(days)}>다시 시도</button>
        </div>
      ) : (
        <>
          {/* KPI 타일 */}
          <div className={styles.kpiGrid}>
            <StatTile
              label="총 가입자"
              value={stats?.kpis.totalUsers ?? '—'}
              sub={stats && stats.kpis.deletedUsers > 0 ? `탈퇴 ${stats.kpis.deletedUsers}명 제외` : undefined}
            />
            <StatTile
              label={`신규 가입 (${days}일)`}
              value={stats?.kpis.newUsers ?? '—'}
              delta={stats?.kpis.newUsersDelta}
              sub="직전 기간 대비"
            />
            <StatTile
              label="총 보유 앨범"
              value={stats?.kpis.ownedCount ?? '—'}
              sub={stats ? `위시 ${stats.kpis.wishCount.toLocaleString('ko-KR')}장` : undefined}
            />
            <StatTile
              label="미답변 문의"
              value={stats?.kpis.openInquiries ?? '—'}
              highlight={!!stats && stats.kpis.openInquiries > 0}
              onClick={() => router.push('/admin/inquiries')}
              sub="클릭해서 관리"
            />
          </div>

          {/* 차트 2×2 */}
          <div className={styles.chartGrid}>
            <ChartCard title="가입자 추이" sub={`최근 ${days}일 · 일별`} isLoading={isLoading}>
              {stats && <SignupAreaChart data={stats.signupTrend} />}
            </ChartCard>

            <ChartCard
              title="API 사용량"
              sub={`최근 ${days}일 · 이벤트별`}
              isLoading={isLoading}
              isEmpty={!!stats && !hasEvents}
              emptyText="수집된 이벤트가 아직 없습니다 — 앱 사용이 시작되면 채워집니다"
            >
              {stats && <EventMultiLineChart data={stats.eventSeries} eventTypes={stats.eventTypes} />}
            </ChartCard>

            <ChartCard
              title="인기 장르 Top 10"
              sub="보유 앨범 기준"
              isLoading={isLoading}
              isEmpty={!!stats && stats.genreDist.length === 0}
            >
              {stats && <GenreBarChart data={stats.genreDist} />}
            </ChartCard>

            <ChartCard title="사용자당 컬렉션 규모" sub="보유 장수 분포" isLoading={isLoading}>
              {stats && <CollectionHistogram data={stats.collectionHistogram} />}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
