'use client';

import React, { useState } from 'react';
import { searchDiscogs } from '@vinyla/core-api';
import styles from './page.module.css';

const genres = [
  { title: '재즈',          sub: 'Jazz',        height: 320, img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' },
  { title: '일렉트로닉',    sub: 'Electronic',  height: 240, img: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=800&auto=format&fit=crop' },
  { title: '시네마틱',      sub: 'Cinematic',   height: 400, img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop' },
  { title: '클래식',        sub: 'Classical',   height: 280, img: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop' },
  { title: '소울',          sub: 'Soul & Funk', height: 360, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop' },
  { title: '앰비언트',      sub: 'Ambient',     height: 220, img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop' },
  { title: '록',            sub: 'Rock',        height: 300, img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' },
  { title: '월드',          sub: 'World',       height: 260, img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=800&auto=format&fit=crop' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const data = await searchDiscogs(query);
    setResults(data);
    setIsSearching(false);
  };

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>Discover Archive</span>
          <h1 className={styles.heroTitle}>
            지금, 어떤<br />
            <em>음악</em>이요?
          </h1>
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="앨범, 아티스트, 레이블 검색"
              className={styles.searchInput}
            />
            <button type="submit" style={{ display: 'none' }}>검색</button>
          </form>
        </div>
      </header>

      <main className={styles.content}>
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{results.length > 0 ? '검색 결과' : '장르'}</h2>
            <button className={styles.viewAllBtn}>전체 →</button>
          </div>

          <div className={styles.masonryGrid}>
            {results.length > 0 ? (
              results.map((item, idx) => (
                <div key={idx} className={styles.masonryItem}>
                  <img
                    src={item.thumb || 'https://via.placeholder.com/200'}
                    alt={item.title}
                    className={styles.genreImage}
                    style={{ height: 260 }}
                    loading="lazy"
                  />
                  <div className={styles.genreContent}>
                    <h3 className={styles.genreTitle} style={{ fontSize: '18px' }}>{item.title}</h3>
                    <p className={styles.genreSub}>{item.artist ? `${item.artist} • ` : ''}{item.format?.join(', ')}</p>
                  </div>
                </div>
              ))
            ) : (
              genres.map((genre, idx) => (
                <div key={idx} className={styles.masonryItem}>
                  <img
                    src={genre.img}
                    alt={genre.title}
                    className={styles.genreImage}
                    style={{ height: genre.height }}
                    loading="lazy"
                  />
                  <div className={styles.genreContent}>
                    <h3 className={styles.genreTitle}>{genre.title}</h3>
                    <p className={styles.genreSub}>{genre.sub}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
