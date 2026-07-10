import React from 'react';
import styles from './ChartCard.module.css';

interface ChartCardProps {
  title: string;
  sub?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}

export const ChartCard = ({ title, sub, isLoading, isEmpty, emptyText, children }: ChartCardProps) => (
  <section className={styles.card}>
    <header className={styles.header}>
      <h3 className={styles.title}>{title}</h3>
      {sub && <span className={styles.sub}>{sub}</span>}
    </header>
    {/* ResponsiveContainer needs a measurable fixed-height parent */}
    <div className={styles.body}>
      {isLoading ? (
        <p className={styles.placeholder}>불러오는 중...</p>
      ) : isEmpty ? (
        <p className={styles.placeholder}>{emptyText || '아직 데이터가 없습니다'}</p>
      ) : (
        children
      )}
    </div>
  </section>
);
