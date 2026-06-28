'use client';

import React, { useState, useEffect } from 'react';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import styles from './VinylGrid.module.css';

type FilterType = 'ALL' | 'OWNED' | 'WISH';

interface VinylGridProps {
  statusFilter?: FilterType;
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter: initialFilter = 'OWNED' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [dbData, setDbData] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      // Hardcode user ID to 1 for demonstration
      const userVinyls = await getUserVinyls(1);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setDbData(mapped);
      }
      setIsLoading(false);
    }
    loadData();

    const subscription = supabase
      .channel('public:USER_VINYL')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        console.log('Realtime change received!', payload);
        // Refresh data
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const dataToUse = dbData.length > 0 ? dbData : mockVinyls;
  const displayedAlbums = dataToUse.filter(album =>
    activeFilter === 'ALL' || album.STATUS === activeFilter
  );

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.pageEyebrow}>My Collection</span>
          <h1 className={styles.pageTitle}>보관함</h1>
          <p className={styles.pageSubtitle}>{displayedAlbums.length} Records</p>
        </div>
        <div className={styles.headerRight}>
          {([
            { value: 'ALL',   label: '전체' },
            { value: 'OWNED', label: '보유 중' },
            { value: 'WISH',  label: '위시' },
          ] as { value: FilterType; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              className={`${styles.filterChip} ${activeFilter === value ? styles.active : ''}`}
              onClick={() => setActiveFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.grid}>
        {displayedAlbums.map((album) => (
          <AlbumCard key={album.ALBUM_ID} album={album} onClick={setSelectedAlbum} />
        ))}
      </div>

      {selectedAlbum && (
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
      )}
    </div>
  );
};
