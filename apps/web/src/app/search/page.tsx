'use client';

import React, { useState } from 'react';
import { useAlbumSearch } from '@vinyla/core-api';
import { AlbumCard } from '../../components/Grid/AlbumCard';
import { DetailModal } from '../../components/Modal/DetailModal';
import { MockVinylData } from '@vinyla/shared-types';
import styles from './page.module.css';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useAlbumSearch(query);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  return (
    <main className={styles.wrapper}>
      <div className={styles.searchHero}>
        <input 
          type="text" 
          className={styles.searchInput}
          placeholder="Search albums, artists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query && (
        <>
          <h2 className={styles.sectionTitle}>Acoustic Landscapes</h2>
          <div className={styles.genreGrid}>
            <div className={`${styles.genreCard} ${styles.bgJazz}`}>
              <div className={styles.genreOverlay} />
              <h3 className={styles.genreCardTitle}>JAZZ</h3>
            </div>
            <div className={`${styles.genreCard} ${styles.bgRock}`}>
              <div className={styles.genreOverlay} />
              <h3 className={styles.genreCardTitle}>ROCK'N ROLL</h3>
            </div>
            <div className={`${styles.genreCard} ${styles.bgElectronic}`}>
              <div className={styles.genreOverlay} />
              <h3 className={styles.genreCardTitle}>ELECTRONIC</h3>
            </div>
            <div className={`${styles.genreCard} ${styles.bgClassical}`}>
              <div className={styles.genreOverlay} />
              <h3 className={styles.genreCardTitle}>CLASSICAL</h3>
            </div>
          </div>
        </>
      )}

      {query && (
        <div>
          <h2 className={styles.sectionTitle}>Search Results {isLoading && '...'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '24px' }}>
            {results.map(album => (
              <AlbumCard key={album.ALBUM_ID} album={album} onClick={setSelectedAlbum} />
            ))}
          </div>
        </div>
      )}

      {selectedAlbum && (
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
      )}
    </main>
  );
}
