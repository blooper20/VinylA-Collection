import React from 'react';
import styles from './StatTile.module.css';

interface StatTileProps {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number;
  onClick?: () => void;
  highlight?: boolean;
}

export const StatTile = ({ label, value, sub, delta, onClick, highlight }: StatTileProps) => (
  <div
    className={`${styles.tile} ${onClick ? styles.clickable : ''} ${highlight ? styles.highlight : ''}`}
    onClick={onClick}
    role={onClick ? 'button' : undefined}
  >
    <p className={styles.label}>{label}</p>
    <p className={styles.value}>{typeof value === 'number' ? value.toLocaleString('ko-KR') : value}</p>
    <div className={styles.footer}>
      {delta !== undefined && (
        <span className={`${styles.delta} ${delta >= 0 ? styles.deltaUp : styles.deltaDown}`}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('ko-KR')}
        </span>
      )}
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  </div>
);
