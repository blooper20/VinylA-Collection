'use client';

import React from 'react';
import styles from './page.module.css';

const stats = [
  { label: '컬렉션 가치',  value: '18,450,000', unit: '₩', sub: '시장 추정가 기준' },
  { label: '보유 LP',      value: '1,242',       unit: '',   sub: '이번 달 +12장 추가' },
  { label: '주요 장르',    value: '쿨 재즈',      unit: '',   sub: '전체의 45%' },
];

const timeline = [
  {
    date: 'Oct 2023',
    title: 'Kind of Blue 초판',
    desc: '파리 지하 레코드샵에서 발견한 1959년 프레싱. 흠 하나 없는 상태입니다.',
    img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=200&auto=format&fit=crop',
  },
  {
    date: 'Aug 2023',
    title: '1,000장 돌파',
    desc: '누적 보유 1,000장을 넘어섰습니다. 마스터 컬렉터 등급 달성.',
    img: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=200&auto=format&fit=crop',
  },
  {
    date: 'May 2023',
    title: '첫 직거래 완료',
    desc: 'A Love Supreme 일본반, 교토 컬렉터와 성사. 정가의 2.3배.',
    img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=200&auto=format&fit=crop',
  },
];

export default function MyProfilePage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.avatarRing}>
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop"
              alt="프로필"
              className={styles.avatarImage}
            />
            <div className={styles.avatarBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileEyebrow}>Master Collector</p>
            <h1 className={styles.profileName}>김재현</h1>
            <div className={styles.collectorBadge}>
              <span className={`material-symbols-outlined ${styles.collectorBadgeIcon}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>diamond</span>
              <span className={styles.collectorBadgeText}>Obsidian Grade · 1994년부터</span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.analytics}>
        <div className={styles.analyticsGrid}>
          {stats.map((stat, i) => (
            <div key={i} className={styles.statCard}>
              <span className={styles.statLabel}>{stat.label}</span>
              <div className={styles.statValue}>
                {stat.unit && <span className={styles.statUnit}>{stat.unit}</span>}
                {stat.value}
              </div>
              <div className={styles.statSub}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.journeySectionHeader}>
          <div className={styles.journeyAccentLine} />
          <h2 className={styles.journeySectionTitle}>수집 기록</h2>
        </div>
        <div className={styles.timeline}>
          {timeline.map((item, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <img src={item.img} alt={item.title} className={styles.timelineImage} />
              <div className={styles.timelineText}>
                <span className={styles.timelineDate}>{item.date}</span>
                <div className={styles.timelineTitle}>{item.title}</div>
                <div className={styles.timelineDesc}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.actions}>
        <button className={styles.btnPrimary}>컬렉션 편집</button>
        <button className={styles.btnSecondary}>데이터 내보내기</button>
      </section>
    </div>
  );
}
