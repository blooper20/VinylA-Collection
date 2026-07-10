'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { StatTile } from '../../components/Admin/StatTile';
import { ChartCard } from '../../components/Admin/ChartCard';
import { SignupAreaChart, DauTrendChart } from '../../components/Admin/charts/AdminCharts';
import { useAdminStats } from '../../components/Admin/AdminStatsContext';
import { StatsErrorBox } from '../../components/Admin/StatsErrorBox';
import styles from './dashboard.module.css';

export default function AdminOverviewPage() {
  const router = useRouter();
  const { stats, days, isLoading, error } = useAdminStats();

  if (error) return <StatsErrorBox />;

  return (
    <div>
      <div className={styles.kpiGrid}>
        <StatTile
          label="총 가입자"
          value={stats?.kpis.totalUsers ?? '—'}
          sub={stats && stats.kpis.deletedUsers > 0 ? `탈퇴 누적 ${stats.kpis.deletedUsers}명` : undefined}
        />
        <StatTile
          label={`신규 가입 (${days}일)`}
          value={stats?.kpis.newUsers ?? '—'}
          delta={stats?.kpis.newUsersDelta}
          sub="직전 기간 대비"
        />
        <StatTile
          label="DAU (오늘)"
          value={stats?.kpis.dau ?? '—'}
          sub={stats ? `WAU ${stats.kpis.wau} · MAU ${stats.kpis.mau}` : undefined}
        />
        <StatTile
          label="미답변 문의"
          value={stats?.kpis.openInquiries ?? '—'}
          highlight={!!stats && stats.kpis.openInquiries > 0}
          onClick={() => router.push('/admin/inquiries')}
          sub="클릭해서 관리"
        />
      </div>

      <div className={styles.chartGrid}>
        <ChartCard title="가입자 추이" sub={`최근 ${days}일 · 일별`} isLoading={isLoading}>
          {stats && <SignupAreaChart data={stats.signupTrend} />}
        </ChartCard>
        <ChartCard
          title="활성 사용자 (DAU) 추이"
          sub={`최근 ${days}일 · 일별`}
          isLoading={isLoading}
          isEmpty={!!stats && stats.dauTrend.every((d) => d.count === 0)}
          emptyText="이벤트 수집 시작 이후부터 채워집니다"
        >
          {stats && <DauTrendChart data={stats.dauTrend} />}
        </ChartCard>
      </div>
    </div>
  );
}
