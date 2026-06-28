import axios from 'axios';

export type AlbumItem = {
  id: number | string;
  title: string;
  artist: string;
  thumb: string;
  year: string;
  genre?: string[];
  format?: string[];
};

export type SearchStatus = 'idle' | 'fetching_itunes' | 'validating' | 'done';

export const searchDiscogs = async (query: string) => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  
  const hasAuth = token || (key && secret);
  const authParams = token ? { token } : { key, secret };

  // 1. First, search Apple Music for best relevancy and covers
  let itunesResults: any[] = [];
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: query,
        entity: 'album',
        limit: 20
      }
    });
    itunesResults = response.data.results.map((item: any) => ({
      id: item.collectionId,
      title: item.collectionName,
      artist: item.artistName,
      thumb: item.artworkUrl100?.replace('100x100bb', '600x600bb'),
      year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
      genre: [item.primaryGenreName]
    }));
  } catch (e) {
    console.error('iTunes search failed:', e);
    return [];
  }

  // 2. If no auth for Discogs, just return all Apple Music results (fallback)
  if (!hasAuth) {
    console.warn('Discogs auth missing! Returning unfiltered Apple Music results.');
    return itunesResults;
  }

  // 3. Filter Apple Music results by checking if they exist as Vinyl on Discogs
  // Increase slice to 15 to catch buried LPs, 15 is safe for Discogs 60/min limit
  const topResults = itunesResults.slice(0, 15);
  
  const validAlbums = (await Promise.all(topResults.map(async (album) => {
    try {
      // Remove (Special Edition), - EP, - Single to make matching easier
      const cleanTitle = album.title.replace(/ - EP| - Single/g, '').replace(/\([^)]*\)/g, '').trim();
      
      // Try with Apple Music's Artist name first
      let dRes = await axios.get('https://api.discogs.com/database/search', {
        params: {
          q: `${album.artist} ${cleanTitle}`,
          ...authParams,
          type: 'release',
          format: 'vinyl'
        }
      });

      // Find a result that actually matches the artist or original query
      let bestMatch = dRes.data.results?.find((r: any) => {
        const t = (r.title || '').toLowerCase();
        return t.includes(album.artist.toLowerCase()) || t.includes(query.toLowerCase());
      });

      // If no valid match, try with the user's original query (fixes English/Korean artist name mismatch)
      if (!bestMatch) {
        dRes = await axios.get('https://api.discogs.com/database/search', {
          params: {
            q: `${query} ${cleanTitle}`,
            ...authParams,
            type: 'release',
            format: 'vinyl'
          }
        });
        bestMatch = dRes.data.results?.find((r: any) => {
          const t = (r.title || '').toLowerCase();
          return t.includes(album.artist.toLowerCase()) || t.includes(query.toLowerCase());
        });
      }
      
      if (bestMatch) {
        const rawTitle = bestMatch.title || '';
        // Discogs titles usually come as "Artist - Title", so we extract the Title
        const parsedTitle = rawTitle.includes(' - ') ? rawTitle.split(' - ').slice(1).join(' - ').trim() : rawTitle;

        return {
          ...album,
          id: bestMatch.id, // Replace iTunes ID with Discogs ID so tracklist fetches correctly!
          title: parsedTitle || album.title
        };
      }
      return null; // No vinyl found, filter it out
    } catch (e: any) {
      console.warn(`Discogs check failed for ${album.title}`, e.message);
      return album; // Fallback to showing it if API fails
    }
  }))).filter(Boolean);

  return validAlbums;
};

/**
 * Streaming / lazy version of searchDiscogs.
 * Calls `onItem` each time a new validated album is found,
 * so the UI can render results progressively instead of waiting for all checks.
 */
export const searchDiscogsLazy = async (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number) => void
): Promise<void> => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;

  const hasAuth = token || (key && secret);
  const authParams = token ? { token } : { key, secret };

  // 1. Fetch Apple Music results
  onStatusChange?.('fetching_itunes');
  let itunesResults: AlbumItem[] = [];
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: { term: query, entity: 'album', limit: 20 }
    });
    itunesResults = response.data.results.map((item: any) => ({
      id: item.collectionId,
      title: item.collectionName,
      artist: item.artistName,
      thumb: item.artworkUrl100?.replace('100x100bb', '600x600bb'),
      year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
      genre: [item.primaryGenreName]
    }));
  } catch (e) {
    console.error('iTunes search failed:', e);
    onStatusChange?.('done', 0);
    return;
  }

  if (!hasAuth) {
    itunesResults.slice(0, 15).forEach(onItem);
    onStatusChange?.('done', itunesResults.length);
    return;
  }

  // 2. Validate each album against Discogs one by one, calling onItem as we go
  const topResults = itunesResults.slice(0, 15);
  onStatusChange?.('validating', topResults.length);

  // Run checks with a small concurrency limit (3 at a time) to avoid rate limiting
  // while still being much faster than sequential
  const CONCURRENCY = 3;
  let found = 0;

  const checkAlbum = async (album: AlbumItem) => {
    try {
      const cleanTitle = album.title.replace(/ - EP| - Single/g, '').replace(/\([^)]*\)/g, '').trim();

      let dRes = await axios.get('https://api.discogs.com/database/search', {
        params: { q: `${album.artist} ${cleanTitle}`, ...authParams, type: 'release', format: 'vinyl' }
      });

      let bestMatch = dRes.data.results?.find((r: any) => {
        const t = (r.title || '').toLowerCase();
        return t.includes(album.artist.toLowerCase()) || t.includes(query.toLowerCase());
      });

      if (!bestMatch) {
        dRes = await axios.get('https://api.discogs.com/database/search', {
          params: { q: `${query} ${cleanTitle}`, ...authParams, type: 'release', format: 'vinyl' }
        });
        bestMatch = dRes.data.results?.find((r: any) => {
          const t = (r.title || '').toLowerCase();
          return t.includes(album.artist.toLowerCase()) || t.includes(query.toLowerCase());
        });
      }

      if (bestMatch) {
        const rawTitle = bestMatch.title || '';
        const parsedTitle = rawTitle.includes(' - ') ? rawTitle.split(' - ').slice(1).join(' - ').trim() : rawTitle;
        found++;
        onItem({ ...album, id: bestMatch.id, title: parsedTitle || album.title });
      }
    } catch (e: any) {
      console.warn(`Discogs check failed for ${album.title}`, e.message);
      // On error, surface the album anyway so user sees something
      onItem(album);
    }
  };

  // Process in batches of CONCURRENCY
  for (let i = 0; i < topResults.length; i += CONCURRENCY) {
    const batch = topResults.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(checkAlbum));
  }

  onStatusChange?.('done', found);
};

export const getAlbumTracks = async (albumId: string | number): Promise<string[]> => {
  // 1. Try iTunes Lookup first (since our primary ALBUM_ID is now from iTunes)
  try {
    const response = await axios.get('https://itunes.apple.com/lookup', {
      params: { id: albumId, entity: 'song' }
    });
    const songs = response.data.results.filter((r: any) => r.wrapperType === 'track');
    if (songs.length > 0) {
      return songs.map((song: any) => song.trackName);
    }
  } catch (error) {
    console.error('iTunes track fetch failed:', error);
  }

  // 2. Fallback to Discogs (for older saved albums that used Discogs IDs)
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  const authParams = token ? { token } : { key, secret };

  try {
    const response = await axios.get(`https://api.discogs.com/releases/${albumId}`, { params: authParams });
    if (response.data.tracklist) {
      return response.data.tracklist.map((t: any) => t.title);
    }
  } catch (error) {
    try {
      const masterRes = await axios.get(`https://api.discogs.com/masters/${albumId}`, { params: authParams });
      if (masterRes.data.tracklist) {
        return masterRes.data.tracklist.map((t: any) => t.title);
      }
    } catch (e) {
      // ignore
    }
  }

  return [];
};

// YouTube Data API Bridge Function
export const searchYouTube = async (query: string) => {
  const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YouTube API key is missing!');
    return [];
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        key: apiKey,
        maxResults: 5,
      },
    });
    return response.data.items;
  } catch (error) {
    console.error('YouTube search failed:', error);
    return [];
  }
};

// Google Cloud Vision API Function
export const analyzeImageWithVisionAPI = async (base64Image: string) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Vision API key is missing! Returning mock text.');
    // Mock result for E2E testing
    return 'The Dark Side of the Moon Pink Floyd LP';
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 10,
              },
            ],
          },
        ],
      }
    );
    const textAnnotations = response.data.responses[0]?.textAnnotations;
    if (textAnnotations && textAnnotations.length > 0) {
      return textAnnotations[0].description;
    }
    return '';
  } catch (error) {
    console.error('Vision API failed:', error);
    return '';
  }
};

export const getHighQualityArtwork = async (title: string, artist: string, fallbackUrl: string): Promise<string> => {
  try {
    const response = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: `${artist} ${title}`,
        entity: 'album',
        limit: 1
      }
    });
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].artworkUrl100?.replace('100x100bb', '600x600bb') || fallbackUrl;
    }
  } catch (e) {
    console.warn('Failed to fetch high quality artwork from iTunes', e);
  }
  return fallbackUrl;
};

