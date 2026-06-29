'use client';

import React, { useState, useEffect } from 'react';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore, createAlbumMaster } from '@vinyla/core-api';
import styles from './VinylGrid.module.css';

type FilterType = 'ALL' | 'OWNED' | 'WISH';

const KNOWN_COUNTRIES = [
  'South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 
  'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 
  'Sweden', 'Taiwan', 'Brazil', 'Russia'
];

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

  // Auto-heal logic: Automatically fetch and restore missing genres/countries for legacy items
  useEffect(() => {
    if (dbData.length === 0) return;

    const migrationDone = typeof window !== 'undefined' && localStorage.getItem('vinyls_migration_v4') === 'true';

    const brokenAlbums = dbData.filter(album => {
      if (!migrationDone) return true; // Force one-time check for all to replace inaccurate Discogs countries
      return (
        !album.GENRES || 
        album.GENRES.length === 0 || 
        (album.GENRES.length === 1 && album.GENRES[0] === 'Vinyl') ||
        // Also heal if it has genres but is missing a country tag
        !album.GENRES.some(tag => KNOWN_COUNTRIES.includes(tag))
      );
    });

    if (brokenAlbums.length === 0) return;

    async function healData() {
      const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
      const key = process.env.NEXT_PUBLIC_DISCOGS_KEY;
      const secret = process.env.NEXT_PUBLIC_DISCOGS_SECRET;
      
      for (const album of brokenAlbums) {
        try {
          // 1. Try Apple Music first for artist's country
          let countryCode = '';
          try {
            const cleanArtist = album.ARTIST.replace(/\s\(\d+\)$/, '').trim();
            const cleanTitle = album.TITLE.split(' / ')[0].split('(')[0].trim();
            const itRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}&entity=album&limit=3`);
            const itJson = await itRes.json();
            const hit = itJson.results?.find((item: any) =>
              item.artistName?.toLowerCase().includes(cleanArtist.toLowerCase()) ||
              cleanArtist.toLowerCase().includes(item.artistName?.toLowerCase())
            );
            if (hit?.country) {
              countryCode = hit.country;
            }
          } catch (e) { /* ignore */ }

          // 2. Fetch Discogs for genres/styles
          const query = encodeURIComponent(`${album.ARTIST} ${album.TITLE}`);
          const authString = token ? `token=${token}` : `key=${key}&secret=${secret}`;
          const res = await fetch(`https://api.discogs.com/database/search?q=${query}&type=release&format=vinyl&per_page=1&${authString}`, {
            headers: { 'User-Agent': 'VinylA/1.0.0' }
          });
          const json = await res.json();
          const result = json.results?.[0];
            let finalCountry = '';
            const hasHangul = /[가-힣]/.test(album.ARTIST) || 
                              /[가-힣]/.test(album.TITLE) || 
                              (album.TRACKS && album.TRACKS.some(t => /[가-힣]/.test(t)));

            if (hasHangul) {
              finalCountry = 'South Korea';
            } else if (countryCode) {
              const mapping: { [key: string]: string } = {
                'KOR': 'South Korea', 'USA': 'US', 'JPN': 'Japan', 'GBR': 'UK',
                'DEU': 'Germany', 'FRA': 'France', 'CAN': 'Canada', 'AUS': 'Australia',
                'ITA': 'Italy', 'SWE': 'Sweden', 'TWN': 'Taiwan', 'BRA': 'Brazil', 'RUS': 'Russia'
              };
              finalCountry = mapping[countryCode.toUpperCase()] || countryCode;
            } else if (result?.country) {
              finalCountry = result.country;
            }

            // Discogs genres mapping
            const combinedGenres = Array.from(new Set([
              ...(result?.genre || []),
              ...(result?.style || []),
              ...(finalCountry ? [finalCountry] : [])
            ]));
            
            // Clean up any double-country tags if they slipped in
            let finalGenres = combinedGenres;
            if (hasHangul) {
              finalGenres = combinedGenres.filter(g => !KNOWN_COUNTRIES.includes(g) || g === 'South Korea');
            }

            if (combinedGenres.length > 0) {
              await createAlbumMaster({
                ALBUM_ID: album.ALBUM_ID,
                TITLE: album.TITLE,
                ARTIST: album.ARTIST,
                RELEASE_YEAR: album.RELEASE_YEAR,
                IMAGE_URL: album.IMAGE_URL,
                VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '',
                CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#1a1c1c',
                CUSTOM_STYLE_TYPE: album.CUSTOM_STYLE_TYPE || 'SOLID',
                TRACKS: album.TRACKS || [],
                GENRES: finalGenres
              });
            }
        } catch (err) {
          console.warn(`Auto-heal failed for ${album.TITLE}:`, err);
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('vinyls_migration_v4', 'true');
      }
      // Refresh local UI state
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    }

    // Delay slightly to prevent slamming during initial render
    const timer = setTimeout(healData, 1000);
    return () => clearTimeout(timer);
  }, [dbData]);

  const dataToUse = dbData.filter(album => statusFilter === 'ALL' || album.STATUS === statusFilter);
  
  const allTags = Array.from(new Set(dataToUse.flatMap(album => album.GENRES || []))).sort();


  const countryTags = allTags.filter(tag => KNOWN_COUNTRIES.includes(tag));
  const genreTags = allTags.filter(tag => !KNOWN_COUNTRIES.includes(tag));

  const displayedAlbums = dataToUse.filter(album =>
    activeTag === 'ALL' || (album.GENRES && album.GENRES.includes(activeTag))
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
          {countryTags.length > 0 && (
            <div className={styles.tagRow}>
              <div className={styles.spacer} />
              {countryTags.map(tag => (
                <button
                  key={tag}
                  className={`${styles.filterChip} ${activeTag === tag ? styles.active : ''}`}
                  onClick={() => setActiveTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className={styles.tagRow}>
            <div className={styles.spacer} />
            <button
              className={`${styles.filterChip} ${activeTag === 'ALL' ? styles.active : ''}`}
              onClick={() => setActiveTag('ALL')}
            >
              전체
            </button>
            {genreTags.map(tag => (
              <button
                key={tag}
                className={`${styles.filterChip} ${activeTag === tag ? styles.active : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
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
