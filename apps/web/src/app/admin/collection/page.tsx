'use client';

import React from 'react';
import { StatTile } from '../../../components/Admin/StatTile';
import { ChartCard } from '../../../components/Admin/ChartCard';
import { HorizontalBarChart, CollectionHistogram } from '../../../components/Admin/charts/AdminCharts';
import { TopAlbumsList } from '../../../components/Admin/InsightBlocks';
import { useAdminStats } from '../../../components/Admin/AdminStatsContext';
import { StatsErrorBox } from '../../../components/Admin/StatsErrorBox';
import styles from '../dashboard.module.css';

const formatKrw = (n: number) =>
  n >= 100000000
    ? `${(n / 100000000).toFixed(1)}억원`
    : n >= 10000
      ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만원`
      : `${n.toLocaleString('ko-KR')}원`;

export default function AdminCollectionPage() {
  const { stats, isLoading, error } = useAdminStats();

  if (error) return <StatsErrorBox />;

  return (
    <div>
      <div className={styles.kpiGrid}>
        <StatTile label="총 보유 앨범" value={stats?.kpis.ownedCount ?? '—'} sub="전체 사용자 합계" />
        <StatTile label="위시리스트" value={stats?.kpis.wishCount ?? '—'} sub="전체 사용자 합계" />
        <StatTile
          label="플랫폼 자산 규모"
          value={stats ? formatKrw(stats.kpis.assetPurchaseTotal) : '—'}
          sub="구매가 합계"
        />
        <StatTile
          label="시장 추정 가치"
          value={stats ? formatKrw(stats.kpis.assetMarketTotal) : '—'}
          sub="시장가 기준 추정"
        />
      </div>

      <div className={styles.chartGrid}>
        <ChartCard
          title="인기 앨범 TOP 10"
          sub="보유+위시 사용자 수 기준"
          isLoading={isLoading}
          isEmpty={!!stats && stats.topAlbums.length === 0}
        >
          {stats && <TopAlbumsList albums={stats.topAlbums} />}
        </ChartCard>
        <ChartCard
          title="인기 아티스트 TOP 10"
          sub="보유+위시 장수 기준"
          isLoading={isLoading}
          isEmpty={!!stats && stats.topArtists.length === 0}
        >
          {stats && (
            <HorizontalBarChart
              data={stats.topArtists.map((a) => ({ label: a.artist, count: a.count }))}
              unit="장"
            />
          )}
        </ChartCard>
        <ChartCard
          title="인기 장르 TOP 10"
          sub="보유 앨범 기준"
          isLoading={isLoading}
          isEmpty={!!stats && stats.genreDist.length === 0}
        >
          {stats && (
            <HorizontalBarChart
              data={stats.genreDist.map((g) => ({ label: g.genre, count: g.count }))}
              unit="장"
            />
          )}
        </ChartCard>
        <ChartCard title="사용자당 컬렉션 규모" sub="보유 장수 분포" isLoading={isLoading}>
          {stats && <CollectionHistogram data={stats.collectionHistogram} />}
        </ChartCard>
      </div>
    </div>
  );
}
