'use client';

import React, { useState, useEffect } from 'react';
import { DetailModal } from '../../components/Modal/DetailModal';
import { useAuthStore, getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import styles from './page.module.css';

export default function WishlistPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [wishes, setWishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user, initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      if (!user) {
        setWishes([]);
        setIsLoading(false);
        return;
      }

      const userId = user.id;
      const userVinyls = await getUserVinyls(userId);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        const wishesData = mapped.filter(a => a.STATUS === 'WISH');
        setWishes(wishesData);
      } else {
        setWishes([]);
      }
      setIsLoading(false);
    }
    
    if (user !== undefined) loadData();

    const subscription = supabase
      .channel('public:USER_VINYL:web_wish')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Archive</span>
        <h1 className={styles.title}>위시리스트</h1>
        <p className={styles.subtitle}>수집을 기다리는 {wishes.length}장의 바이닐</p>
      </header>

      {isLoading ? (
        <div style={{ padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
      ) : wishes.length === 0 ? (
        <div style={{ padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>아직 위시리스트에 담긴 바이닐이 없습니다.</div>
      ) : (
        <div className={styles.simpleGrid}>
          {wishes.map((rec) => (
            <div key={rec.ALBUM_ID} className={styles.card} onClick={() => setSelectedAlbum(rec)}>
              <div className={styles.coverWrapper}>
                <img src={rec.IMAGE_URL || rec.COVER_URL} alt={rec.TITLE} className={styles.cover} loading="lazy" />
                <div className={styles.coverOverlay}>
                  <span className="material-symbols-outlined">zoom_in</span>
                </div>
              </div>
              <div className={styles.info}>
                <h2 className={styles.albumTitle}>{rec.TITLE}</h2>
                <p className={styles.albumArtist}>{rec.ARTIST} <span className={styles.dot}>•</span> {rec.RELEASE_YEAR}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAlbum && (
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
      )}
    </div>
  );
}
