'use client';

import React from 'react';
import { StatTile } from '../../../components/Admin/StatTile';
import { ChartCard } from '../../../components/Admin/ChartCard';
import { HorizontalBarChart } from '../../../components/Admin/charts/AdminCharts';
import { useAdminStats } from '../../../components/Admin/AdminStatsContext';
import { StatsErrorBox } from '../../../components/Admin/StatsErrorBox';
import styles from '../dashboard.module.css';

export default function AdminAcquisitionPage() {
  const { stats, days, isLoading, error } = useAdminStats();

  if (error) return <StatsErrorBox />;

  const hasVisits = !!stats && stats.acquisition.visits > 0;

  return (
    <div>
      <div className={styles.kpiGrid}>
        <StatTile label={`방문 (${days}일)`} value={stats?.acquisition.visits ?? '—'} sub="세션 기준" />
        <StatTile
          label="방문 → 가입 전환"
          value={stats && stats.acquisition.visitToSignup !== null ? `${stats.acquisition.visitToSignup}%` : '—'}
          sub={stats ? `가입 ${stats.acquisition.signups}명` : undefined}
        />
        <StatTile
          label="공유 링크 유입"
          value={stats?.acquisition.shareVisits ?? '—'}
          sub={stats ? `그중 가입 ${stats.acquisition.shareSignups}명` : undefined}
        />
        <StatTile
          label="가입 수단 1위"
          value={stats?.acquisition.signupsByProvider[0]?.label ?? '—'}
          sub={stats?.acquisition.signupsByProvider.map((p) => `${p.label} ${p.count}`).join(' · ')}
        />
      </div>

      <div className={styles.chartGrid}>
        <ChartCard
          title="유입 소스"
          sub={`최근 ${days}일 · 방문 기준`}
          isLoading={isLoading}
          isEmpty={!!stats && !hasVisits}
          emptyText="방문 이벤트가 아직 없습니다 — 새 배포 이후 방문부터 집계됩니다"
        >
          {stats && (
            <HorizontalBarChart data={stats.acquisition.visitsBySource} color="#9085e9" unit="회" />
          )}
        </ChartCard>
        <ChartCard
          title="가입 유입 경로"
          sub="신규 가입자의 첫 유입 소스"
          isLoading={isLoading}
          isEmpty={!!stats && stats.acquisition.signupsBySource.length === 0}
          emptyText="신규 가입 이벤트가 아직 없습니다"
        >
          {stats && (
            <HorizontalBarChart data={stats.acquisition.signupsBySource} color="#199e70" unit="명" />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
