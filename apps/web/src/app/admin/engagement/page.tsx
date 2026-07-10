'use client';

import React from 'react';
import { StatTile } from '../../../components/Admin/StatTile';
import { ChartCard } from '../../../components/Admin/ChartCard';
import {
  HorizontalBarChart,
  ScanStackedBars,
  ScanSuccessRateLine,
} from '../../../components/Admin/charts/AdminCharts';
import { ActivityHeatmap, ScanFailureList } from '../../../components/Admin/InsightBlocks';
import { useAdminStats } from '../../../components/Admin/AdminStatsContext';
import { StatsErrorBox } from '../../../components/Admin/StatsErrorBox';
import styles from '../dashboard.module.css';

export default function AdminEngagementPage() {
  const { stats, days, isLoading, error } = useAdminStats();

  if (error) return <StatsErrorBox />;

  return (
    <div>
      <div className={styles.kpiGrid}>
        <StatTile label={`검색 (${days}일)`} value={stats?.conversion.searches ?? '—'} />
        <StatTile
          label="검색 → 등록 전환"
          value={stats && stats.conversion.searchToAdd !== null ? `${stats.conversion.searchToAdd}%` : '—'}
          sub={stats ? `등록 ${stats.conversion.adds}건` : undefined}
        />
        <StatTile label={`위시 추가 (${days}일)`} value={stats?.conversion.wishAdds ?? '—'} />
        <StatTile
          label="위시 → 보유 전환"
          value={stats && stats.conversion.wishToOwned !== null ? `${stats.conversion.wishToOwned}%` : '—'}
          sub={stats ? `전환 ${stats.conversion.wishConverted}건` : '위시가 실구매로 이어진 비율'}
        />
      </div>

      <div className={styles.chartGrid}>
        <ChartCard
          title="활동 히트맵"
          sub="요일 × 시간대 (KST)"
          isLoading={isLoading}
          isEmpty={!!stats && stats.heatmap.every((c) => c.count === 0)}
          emptyText="이벤트 수집 시작 이후부터 채워집니다"
        >
          {stats && <ActivityHeatmap data={stats.heatmap} />}
        </ChartCard>
        <ChartCard
          title="AI 스캔 사용량"
          sub={
            stats && stats.scanStats.successRate !== null
              ? `총 ${stats.scanStats.total}회 · 성공률 ${stats.scanStats.successRate}%`
              : `최근 ${days}일 · Gemini 스캔 파이프라인`
          }
          isLoading={isLoading}
          isEmpty={!!stats && stats.scanStats.total === 0}
          emptyText="앱에서 카메라 스캔이 실행되면 채워집니다"
        >
          {stats && <ScanStackedBars data={stats.scanStats.series} />}
        </ChartCard>
        <ChartCard
          title="AI 스캔 성공률"
          sub="일별 · 스캔 없는 날은 표시 안 함"
          isLoading={isLoading}
          isEmpty={!!stats && stats.scanStats.total === 0}
          emptyText="앱에서 카메라 스캔이 실행되면 채워집니다"
        >
          {stats && <ScanSuccessRateLine data={stats.scanStats.series} />}
        </ChartCard>
        <ChartCard
          title="스캔 오류 유형"
          sub={`최근 ${days}일`}
          isLoading={isLoading}
          isEmpty={!!stats && stats.scanStats.errorTypes.length === 0}
          emptyText="오류가 없습니다 🎉"
        >
          {stats && <HorizontalBarChart data={stats.scanStats.errorTypes} color="#e66767" unit="회" />}
        </ChartCard>
        <ChartCard
          title="최근 스캔 실패 내역"
          sub="최신 20건"
          isLoading={isLoading}
          isEmpty={!!stats && stats.scanStats.recentFailures.length === 0}
          emptyText="실패한 스캔이 없습니다 🎉"
        >
          {stats && <ScanFailureList failures={stats.scanStats.recentFailures} />}
        </ChartCard>
      </div>
    </div>
  );
}
