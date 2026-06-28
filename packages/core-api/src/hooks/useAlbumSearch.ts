import { useState, useEffect } from 'react';
import { MockVinylData } from '@vinyla/shared-types';
import { searchDiscogs, getHighQualityArtwork } from '../externalApi';

export const useAlbumSearch = (query: string) => {
  const [results, setResults] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const discogsResults = await searchDiscogs(query);
        
        if (!isMounted) return;

        if (!discogsResults || discogsResults.length === 0) {
          setResults([]);
        } else {
          const mapped = discogsResults.map((item: any) => ({
            ALBUM_ID: item.id || Date.now() + Math.random(),
            TITLE: item.title || 'Unknown Title',
            ARTIST: item.artist || 'Unknown Artist',
            RELEASE_YEAR: parseInt(item.year) || new Date().getFullYear(),
            IMAGE_URL: item.thumb || 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80',
            VINYL_IMAGE_URL: '',
            CUSTOM_COLOR_HEX: '#111',
            CUSTOM_STYLE_TYPE: 'SOLID',
            GENRES: item.genre || ['Vinyl']
          }));
          
          setResults(mapped);
        }
      } catch (err: any) {
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, isLoading, error };
};
