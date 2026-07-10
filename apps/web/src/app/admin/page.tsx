'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@vinyla/core-api';
import { StatTile } from '../../components/Admin/StatTile';
import { ChartCard } from '../../components/Admin/ChartCard';
import {
  SignupAreaChart,
  EventMultiLineChart,
  DauTrendChart,
  HorizontalBarChart,
  CollectionHistogram,
} from '../../components/Admin/charts/AdminCharts';
import {
  FunnelBars,
  ActivityHeatmap,
  RetentionTable,
  TopAlbumsList,
} from '../../components/Admin/InsightBlocks';
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

const PERIODS = [7, 30, 90];

const CATEGORY_LABEL: Record<string, string> = {
  COMPLAINT: '불만',
  SUGGESTION: '건의',
  BUG: '버그',
  GENERAL: '기타',
};

const formatKrw = (n: number) =>
  n >= 100000000
    ? `${(n / 100000000).toFixed(1)}억원`
    : n >= 10000
      ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만원`
      : `${n.toLocaleString('ko-KR')}원`;

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
    !!stats && stats.eventSeries.some((row) => stats.eventTypes.some((t) => Number(row[t]) > 0));
  const hasVisits = !!stats && stats.acquisition.visits > 0;

  if (error) {
    return (
      <div className={styles.errorBox}>
        <p>{error}</p>
        <button type="button" onClick={() => loadStats(days)}>다시 시도</button>
      </div>
    );
  }

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

      {/* ── 헤드라인 KPI ─────────────────────────── */}
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
        <StatTile label="DAU (오늘)" value={stats?.kpis.dau ?? '—'} sub={stats ? `WAU ${stats.kpis.wau} · MAU ${stats.kpis.mau}` : undefined} />
        <StatTile
          label="미답변 문의"
          value={stats?.kpis.openInquiries ?? '—'}
          highlight={!!stats && stats.kpis.openInquiries > 0}
          onClick={() => router.push('/admin/inquiries')}
          sub="클릭해서 관리"
        />
      </div>
      <div className={styles.kpiGrid}>
        <StatTile
          label="고착도 (DAU/MAU)"
          value={stats ? `${stats.kpis.stickiness}%` : '—'}
          sub="높을수록 습관적 사용"
        />
        <StatTile label="휴면 사용자" value={stats?.kpis.dormantUsers ?? '—'} sub="최근 14일 무활동" />
        <StatTile
          label="총 보유 앨범"
          value={stats?.kpis.ownedCount ?? '—'}
          sub={stats ? `위시 ${stats.kpis.wishCount.toLocaleString('ko-KR')}장` : undefined}
        />
        <StatTile
          label="플랫폼 자산 규모"
          value={stats ? formatKrw(stats.kpis.assetPurchaseTotal) : '—'}
          sub={stats ? `시장 추정 ${formatKrw(stats.kpis.assetMarketTotal)}` : '구매가 합계'}
        />
      </div>

      {/* ── 유입 (Acquisition) ───────────────────── */}
      <h2 className={styles.sectionTitle}>유입</h2>
      <div className={styles.kpiGrid}>
        <StatTile label={`방문 (${days}일)`} value={stats?.acquisition.visits ?? '—'} sub="세션 기준" />
        <StatTile
          label="방문 → 가입 전환"
          value={stats?.acquisition.visitToSignup !== null && stats ? `${stats.acquisition.visitToSignup}%` : '—'}
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
            <HorizontalBarChart
              data={stats.acquisition.visitsBySource}
              color="#9085e9"
              unit="회"
            />
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

      {/* ── 성장 (Growth) ────────────────────────── */}
      <h2 className={styles.sectionTitle}>성장</h2>
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
        <ChartCard title="활성화 퍼널" sub="가입 → 프로필 → 첫 앨범" isLoading={isLoading}>
          {stats && <FunnelBars funnel={stats.funnel} />}
        </ChartCard>
        <ChartCard title="주간 리텐션 코호트" sub="가입 주차별 재방문율" isLoading={isLoading}>
          {stats && <RetentionTable cohorts={stats.retentionCohorts} />}
        </ChartCard>
      </div>

      {/* ── 사용 (Engagement) ─────────────────────── */}
      <h2 className={styles.sectionTitle}>사용</h2>
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
          title="API 사용량"
          sub={`최근 ${days}일 · 이벤트별`}
          isLoading={isLoading}
          isEmpty={!!stats && !hasEvents}
          emptyText="수집된 이벤트가 아직 없습니다 — 앱 사용이 시작되면 채워집니다"
        >
          {stats && <EventMultiLineChart data={stats.eventSeries} eventTypes={stats.eventTypes} />}
        </ChartCard>
        <ChartCard
          title="활동 히트맵"
          sub="요일 × 시간대 (KST)"
          isLoading={isLoading}
          isEmpty={!!stats && stats.heatmap.every((c) => c.count === 0)}
          emptyText="이벤트 수집 시작 이후부터 채워집니다"
        >
          {stats && <ActivityHeatmap data={stats.heatmap} />}
        </ChartCard>
      </div>

      {/* ── 컬렉션 (Content) ──────────────────────── */}
      <h2 className={styles.sectionTitle}>컬렉션</h2>
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

      {/* ── 운영 (Ops) ────────────────────────────── */}
      <h2 className={styles.sectionTitle}>운영</h2>
      <div className={styles.kpiGrid}>
        <StatTile label="총 문의" value={stats?.inquiryOps.total ?? '—'} sub="누적" />
        <StatTile
          label="평균 첫 응답 시간"
          value={
            stats && stats.inquiryOps.avgFirstReplyHours !== null
              ? `${stats.inquiryOps.avgFirstReplyHours}시간`
              : '—'
          }
        />
        <StatTile
          label="최장 미답변"
          value={stats ? `${stats.inquiryOps.oldestOpenDays}일` : '—'}
          highlight={!!stats && stats.inquiryOps.oldestOpenDays >= 3}
        />
        <StatTile
          label="문의 유형 분포"
          value={
            stats && stats.inquiryOps.categories.length > 0
              ? CATEGORY_LABEL[stats.inquiryOps.categories.sort((a, b) => b.count - a.count)[0].category] ||
                stats.inquiryOps.categories[0].category
              : '—'
          }
          sub={stats?.inquiryOps.categories
            .map((c) => `${CATEGORY_LABEL[c.category] || c.category} ${c.count}`)
            .join(' · ')}
        />
      </div>
    </div>
  );
}
