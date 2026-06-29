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

export type SearchStatus = 'idle' | 'fetching_discogs' | 'enriching' | 'done';

// ─── Discogs-first, Apple Music–enriched search ───────────────────────────────
// Strategy:
//   1. Discogs: query directly with format=vinyl → same results as the Discogs website.
//      Client-side filter: format array must contain "LP" or "Album" (removes 7"/12" singles).
//   2. Deduplicate by master_id: same album reissued many times → one card.
//   3. Apple Music: enrich each result with a 600×600 cover image.
//
// Why not Apple Music-first?
//   Apple Music misses albums not indexed under the search query (e.g., "검정치마" shows
//   "The Black Skirts" works; Teen Troubles / Hollywood never appear in results).
//   Discogs website search is the ground-truth for vinyl availability.
// ─────────────────────────────────────────────────────────────────────────────

// Formats that indicate a full-length album (not a single/EP)
const isAlbumFormat = (formats: string[]): boolean => {
  const f = formats.map((s) => s.toLowerCase());
  // Must have LP or Album marker, and must NOT be a 7"/45RPM-only release
  const hasAlbum = f.includes('lp') || f.includes('album');
  const isSingle = f.includes('single') || (f.includes('7"') && !f.includes('lp') && !f.includes('album'));
  return hasAlbum && !isSingle;
};

// Discogs titles come as "Artist - Title"; extract both parts
const parseDiscogsTitle = (raw: string): { artist: string; title: string } => {
  if (raw.includes(' - ')) {
    const idx = raw.indexOf(' - ');
    return { artist: raw.slice(0, idx).trim(), title: raw.slice(idx + 3).trim() };
  }
  return { artist: '', title: raw.trim() };
};

export const searchDiscogsLazy = async (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number) => void
): Promise<void> => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  const authParams = token ? { token } : { key, secret };

  onStatusChange?.('fetching_discogs');

  // ── Step 1: Discogs vinyl search (2 pages in parallel = 100 candidates) ──────
  let raw: any[] = [];
  try {
    const pages = await Promise.all([1, 2].map((page) =>
      axios.get('https://api.discogs.com/database/search', {
        params: {
          q: query,
          ...authParams,
          type: 'release',
          format: 'vinyl',   // broad vinyl filter — LP/7"/12"
          per_page: 50,
          page,
          sort: 'want',
          sort_order: 'desc',
        },
        headers: { 'User-Agent': 'VinylA/1.0.0' }
      }).then((r) => r.data.results || []).catch(() => [])
    ));
    raw = pages.flat();
  } catch (e) {
    console.error('Discogs search failed:', e);
    onStatusChange?.('done', 0);
    return;
  }

  if (raw.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  // ── Step 2: Client-side filter → LP/Album formats only ─────────────────────
  // Then deduplicate by master_id
  const seenMasters = new Set<number>();
  const seenTitles = new Set<string>();
  const unique: any[] = [];

  for (const r of raw) {
    const formats: string[] = r.format || [];
    if (!isAlbumFormat(formats)) continue; // skip 7" singles, 12" EPs etc.

    if (r.master_id && r.master_id !== 0 && seenMasters.has(r.master_id)) continue;
    const normTitle = (r.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenTitles.has(normTitle)) continue;

    if (r.master_id && r.master_id !== 0) seenMasters.add(r.master_id);
    seenTitles.add(normTitle);
    unique.push(r);

    if (unique.length >= 15) break;
  }

  if (unique.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  onStatusChange?.('enriching', unique.length);

  // ── Step 3: Enrich each LP with Apple Music cover art (3 concurrent) ────────
  const CONCURRENCY = 3;

  const enrich = async (r: any) => {
    const { artist, title } = parseDiscogsTitle(r.title || '');

    // Discogs cover image (often available and decent quality)
    let thumb = r.cover_image || r.thumb || '';

    // Try Apple Music for a better image
    if (!thumb || thumb.includes('spacer.gif')) {
      try {
        const itRes = await axios.get('https://itunes.apple.com/search', {
          params: { term: `${artist} ${title}`, entity: 'album', limit: 3 }
        });
        // Pick the Apple Music result whose artist best matches
        const hit = itRes.data.results?.find((item: any) =>
          item.artistName?.toLowerCase().includes(query.toLowerCase()) ||
          item.artistName?.toLowerCase().includes(artist.toLowerCase())
        ) || itRes.data.results?.[0];
        if (hit?.artworkUrl100) {
          thumb = hit.artworkUrl100.replace('100x100bb', '600x600bb');
        }
      } catch (_) { /* keep Discogs thumb */ }
    }

    onItem({
      id: r.master_id || r.id,
      title,
      artist,
      thumb,
      year: r.year ? String(r.year) : '',
      format: r.format || ['Vinyl', 'LP'],
    });
  };

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    await Promise.all(unique.slice(i, i + CONCURRENCY).map(enrich));
  }

  onStatusChange?.('done', unique.length);
};

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

