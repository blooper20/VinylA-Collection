'use client';

import React from 'react';
import styles from './page.module.css';

const genres = [
  { title: 'Acoustic Landscapes', count: '1,204 Records', height: '400px', img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=2000&auto=format&fit=crop' },
  { title: 'Electronic Pulse', count: '892 Records', height: '300px', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2000&auto=format&fit=crop' },
  { title: 'Jazz Noir', count: '645 Records', height: '500px', img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=2000&auto=format&fit=crop' },
  { title: 'Classical Serenity', count: '1,532 Records', height: '350px', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2000&auto=format&fit=crop' },
];

export default function SearchPage() {
  return (
    <div className={`${styles.container} doodle-bg`}>
      {/* Hero Header */}
      <header className={styles.header}>
        <div className={styles.headerGradient} />
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Discover the Archive</h1>
          
          <div className={styles.searchWrapper}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input 
              type="text" 
              placeholder="Search by title, artist, or genre..." 
              className={styles.searchInput}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.content}>
        {/* Curated Genres (Masonry) */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Curated Genres</h2>
            <button className={styles.viewAll}>
              View All <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          
          <div className={styles.masonryGrid}>
            {genres.map((genre, idx) => (
              <div key={idx} className={styles.masonryItem} style={{ height: genre.height }}>
                <div className={styles.genreOverlay} />
                <div className={styles.genreLight} />
                <div 
                  className={styles.genreImage} 
                  style={{ backgroundImage: `url(${genre.img})` }} 
                />
                <div className={styles.genreContent}>
                  <h3 className={styles.genreTitle}>{genre.title}</h3>
                  <p className={styles.genreCount}>{genre.count}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Trending Curations */}
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Trending Curations</h2>
            <button className={styles.viewAll}>
              View All <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {/* TODO: Integrate existing VinylGrid/AlbumCard components here */}
            Album list will be displayed here using existing components.
          </div>
        </section>
      </main>
    </div>
  );
}
