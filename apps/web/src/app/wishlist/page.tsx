'use client';

import React, { useState } from 'react';
import { DetailModal } from '../../components/Modal/DetailModal';
import { MockVinylData } from '@vinyla/shared-types';
import styles from './page.module.css';

const records = [
  { ALBUM_ID: 'w1', TITLE: 'Bitches Brew',          ARTIST: 'Miles Davis',   IMAGE_URL: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=600', STATUS: 'WISH', RELEASE_YEAR: 1970 },
  { ALBUM_ID: 'spot-1', TITLE: 'The Black Saint and the Sinner Lady', ARTIST: 'Charles Mingus', IMAGE_URL: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600', STATUS: 'WISH', RELEASE_YEAR: 1963 },
  { ALBUM_ID: 'w2', TITLE: 'A Love Supreme',        ARTIST: 'John Coltrane', IMAGE_URL: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=600', STATUS: 'WISH', RELEASE_YEAR: 1965 },
  { ALBUM_ID: 'w3', TITLE: 'Pastel Blues',          ARTIST: 'Nina Simone',   IMAGE_URL: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600', STATUS: 'WISH', RELEASE_YEAR: 1965 },
  { ALBUM_ID: 'w4', TITLE: 'The Birth of the Cool', ARTIST: 'Miles Davis',   IMAGE_URL: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=600', STATUS: 'WISH', RELEASE_YEAR: 1957 },
];

export default function WishlistPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Archive</span>
        <h1 className={styles.title}>위시리스트</h1>
        <p className={styles.subtitle}>수집을 기다리는 {records.length}장의 바이닐</p>
      </header>

      <div className={styles.simpleGrid}>
        {records.map((rec) => (
          <div key={rec.ALBUM_ID} className={styles.card} onClick={() => setSelectedAlbum(rec as any)}>
            <div className={styles.coverWrapper}>
              <img src={rec.IMAGE_URL} alt={rec.TITLE} className={styles.cover} loading="lazy" />
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

      {selectedAlbum && (
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
      )}
    </div>
  );
}
