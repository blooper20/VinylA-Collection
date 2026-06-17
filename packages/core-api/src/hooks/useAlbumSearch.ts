import { useState, useEffect } from 'react';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';

export const useAlbumSearch = (query: string) => {
  const [results, setResults] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    // Simulate API delay
    const timer = setTimeout(() => {
      const lowerQuery = query.toLowerCase();
      const filtered = mockVinyls.filter(album => 
        album.TITLE.toLowerCase().includes(lowerQuery) || 
        album.ARTIST.toLowerCase().includes(lowerQuery)
      );
      setResults(filtered);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  return { results, isLoading };
};
