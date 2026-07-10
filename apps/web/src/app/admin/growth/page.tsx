'use client';

import React from 'react';
import { StatTile } from '../../../components/Admin/StatTile';
import { ChartCard } from '../../../components/Admin/ChartCard';
import { FunnelBars, RetentionTable } from '../../../components/Admin/InsightBlocks';
import { useAdminStats } from '../../../components/Admin/AdminStatsContext';
import { StatsErrorBox } from '../../../components/Admin/StatsErrorBox';
import styles from '../dashboard.module.css';

export default function AdminGrowthPage() {
  const { stats, isLoading, error } = useAdminStats();

  if (error) return <StatsErrorBox />;

  return (
    <div>
      <div className={styles.kpiGrid}>
        <StatTile
          label="고착도 (DAU/MAU)"
          value={stats ? `${stats.kpis.stickiness}%` : '—'}
          sub="높을수록 습관적 사용"
        />
        <StatTile label="휴면 사용자" value={stats?.kpis.dormantUsers ?? '—'} sub="최근 14일 무활동" />
      </div>

      <div className={styles.chartGrid}>
        <ChartCard title="활성화 퍼널" sub="가입 → 프로필 → 첫 앨범" isLoading={isLoading}>
          {stats && <FunnelBars funnel={stats.funnel} />}
        </ChartCard>
        <ChartCard title="주간 리텐션 코호트" sub="가입 주차별 재방문율" isLoading={isLoading}>
          {stats && <RetentionTable cohorts={stats.retentionCohorts} />}
        </ChartCard>
      </div>
    </div>
  );
}
