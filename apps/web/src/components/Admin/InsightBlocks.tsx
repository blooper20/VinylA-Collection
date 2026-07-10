'use client';

import React from 'react';
import styles from './InsightBlocks.module.css';

// ── 활성화 퍼널: 가입 → 프로필 설정 → 첫 앨범 등록 ──────────────
export const FunnelBars = ({
  funnel,
}: {
  funnel: { signedUp: number; profileDone: number; firstAlbum: number };
}) => {
  const steps = [
    { label: '가입 완료', value: funnel.signedUp },
    { label: '프로필 설정', value: funnel.profileDone },
    { label: '첫 앨범 등록', value: funnel.firstAlbum },
  ];
  const max = Math.max(1, funnel.signedUp);

  return (
    <div className={styles.funnel}>
      {steps.map((step, i) => {
        const prev = i === 0 ? null : steps[i - 1].value;
        const rate = prev ? Math.round((step.value / Math.max(1, prev)) * 100) : null;
        return (
          <div key={step.label} className={styles.funnelStep}>
            <div className={styles.funnelLabelRow}>
              <span className={styles.funnelLabel}>{step.label}</span>
              <span className={styles.funnelValue}>
                {step.value.toLocaleString('ko-KR')}명
                {rate !== null && <span className={styles.funnelRate}> · {rate}%</span>}
              </span>
            </div>
            <div className={styles.funnelTrack}>
              <div className={styles.funnelBar} style={{ width: `${(step.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── 요일 × 시간 활동 히트맵 (sequential 단일 블루) ────────────────
const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export const ActivityHeatmap = ({
  data,
}: {
  data: { dow: number; hour: number; count: number }[];
}) => {
  const max = Math.max(1, ...data.map((c) => c.count));
  const cell = (dow: number, hour: number) =>
    data.find((c) => c.dow === dow && c.hour === hour)?.count || 0;

  return (
    <div className={styles.heatmapWrap}>
      <div className={styles.heatmap}>
        {DOW_LABELS.map((label, dow) => (
          <React.Fragment key={dow}>
            <span className={styles.heatmapDow}>{label}</span>
            {Array.from({ length: 24 }).map((_, hour) => {
              const count = cell(dow, hour);
              const alpha = count === 0 ? 0 : 0.12 + (count / max) * 0.88;
              return (
                <div
                  key={hour}
                  className={styles.heatmapCell}
                  style={{ background: count === 0 ? 'var(--bg-surface-low)' : `rgba(57, 135, 229, ${alpha})` }}
                  title={`${label}요일 ${hour}시 · ${count}건`}
                />
              );
            })}
          </React.Fragment>
        ))}
        <span />
        {Array.from({ length: 24 }).map((_, hour) => (
          <span key={hour} className={styles.heatmapHour}>
            {hour % 6 === 0 ? hour : ''}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── 주간 가입 코호트 리텐션 표 ────────────────────────────────────
export const RetentionTable = ({
  cohorts,
}: {
  cohorts: { cohort: string; size: number; weeks: (number | null)[] }[];
}) => (
  <div className={styles.retentionWrap}>
    <table className={styles.retention}>
      <thead>
        <tr>
          <th>가입 주</th>
          <th>인원</th>
          {cohorts[0]?.weeks.map((_, w) => (
            <th key={w}>{w}주</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cohorts.map((row) => (
          <tr key={row.cohort}>
            <td className={styles.retentionCohort}>{row.cohort}</td>
            <td className={styles.retentionSize}>{row.size}</td>
            {row.weeks.map((pct, w) => (
              <td key={w}>
                {pct === null ? (
                  <span className={styles.retentionFuture}>·</span>
                ) : (
                  <span
                    className={styles.retentionCell}
                    style={{ background: `rgba(25, 158, 112, ${pct === 0 ? 0.04 : 0.15 + (pct / 100) * 0.85})` }}
                  >
                    {pct}%
                  </span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ── 인기 앨범 TOP 10 리스트 ──────────────────────────────────────
export const TopAlbumsList = ({
  albums,
}: {
  albums: { albumId: number; title: string; artist: string; image: string; users: number }[];
}) => (
  <ol className={styles.topAlbums}>
    {albums.map((album, i) => (
      <li key={album.albumId} className={styles.topAlbumRow}>
        <span className={styles.topAlbumRank}>{i + 1}</span>
        {album.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.image} alt="" className={styles.topAlbumCover} />
        ) : (
          <span className={styles.topAlbumCoverEmpty} />
        )}
        <span className={styles.topAlbumInfo}>
          <span className={styles.topAlbumTitle}>{album.title}</span>
          <span className={styles.topAlbumArtist}>{album.artist}</span>
        </span>
        <span className={styles.topAlbumUsers}>{album.users}명</span>
      </li>
    ))}
  </ol>
);
