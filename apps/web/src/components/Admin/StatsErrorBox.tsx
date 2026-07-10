'use client';

import React from 'react';
import { useAdminStats } from './AdminStatsContext';
import styles from './StatsErrorBox.module.css';

export const StatsErrorBox = () => {
  const { error, reload } = useAdminStats();
  if (!error) return null;
  return (
    <div className={styles.box}>
      <p>{error}</p>
      <button type="button" onClick={reload}>다시 시도</button>
    </div>
  );
};
