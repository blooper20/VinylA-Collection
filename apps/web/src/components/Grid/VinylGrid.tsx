'use client';

import React, { useState, useEffect } from 'react';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore } from '@vinyla/core-api';
import styles from './VinylGrid.module.css';

type FilterType = 'ALL' | 'OWNED' | 'WISH';

interface VinylGridProps {
  statusFilter?: FilterType;
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter = 'ALL' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [activeTag, setActiveTag] = useState<string>('ALL');
  const [dbData, setDbData] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user, initializeAuth } = useAuthStore();
  const router = require('next/navigation').useRouter();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (user && !user.user_metadata?.displayName) {
      router.replace('/setup');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      // Load from localStorage cache
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('vinyls_dbData');
        if (cached) {
          try { setDbData(JSON.parse(cached)); } catch(e){}
        }
      }

      if (!user) {
        setDbData([]);
        setIsLoading(false);
        return;
      }

      const userId = user.id;
      const userVinyls = await getUserVinyls(userId);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setDbData(mapped);
        
        if (typeof window !== 'undefined') {
          localStorage.setItem('vinyls_dbData', JSON.stringify(mapped));
        }
      } else {
        setDbData([]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('vinyls_dbData', '[]');
        }
      }
      setIsLoading(false);
    }
    
    if (user !== undefined) loadData();

    const subscription = supabase
      .channel('public:USER_VINYL:web_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        console.log('Realtime change received!', payload);
        if (user) loadData();
      })
      .subscribe();

    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);

    return () => {
      supabase.removeChannel(subscription);
      window.removeEventListener('REFRESH_VINYLS', handleRefresh);
    };
  }, [user]);

  const dataToUse = dbData.filter(album => statusFilter === 'ALL' || album.STATUS === statusFilter);
  
  const allTags = Array.from(new Set(dataToUse.flatMap(album => album.GENRE || []))).sort();

  const displayedAlbums = dataToUse.filter(album =>
    activeTag === 'ALL' || (album.GENRE && album.GENRE.includes(activeTag))
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
          <button
            className={`${styles.filterChip} ${activeTag === 'ALL' ? styles.active : ''}`}
            onClick={() => setActiveTag('ALL')}
          >
            전체
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              className={`${styles.filterChip} ${activeTag === tag ? styles.active : ''}`}
              onClick={() => setActiveTag(tag)}
            >
              {tag}
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
