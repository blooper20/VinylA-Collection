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

// ─── Apple Music-first, Discogs-verified search ───────────────────────────────
// Strategy:
//   1. Apple Music: search albums, filter to collectionType="Album" + trackCount≥4
//      This cleanly removes singles, EPs (most of them), and noise from results.
//   2. Discogs: for each candidate, verify an LP exists using release_title exact match.
//      Only albums confirmed as vinyl LP are surfaced.
//   3. Cover art: always Apple Music quality (600×600), no Discogs fallback needed.
//
// Why this works better than Discogs-first:
//   - Apple Music search relevance is superior (returns the right artist first)
//   - collectionType="Album" filter is a clean Apple Music category flag
//   - Discogs release_title match is more accurate than fuzzy q= search
// ─────────────────────────────────────────────────────────────────────────────

// Keywords that indicate a cover/tribute/compilation album that isn't an original LP
const NOISE_PATTERN = /tribute|lullaby|rendition|performs|piano|acoustic|cover|remix|rmx|8-bit|babies|baby|instrumental|bluegrass|dub|ambient|jazz symphony|ukulele|string quartet|cello|boiler room|sleepy|relaxing/i;

export const searchDiscogsLazy = async (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number) => void
): Promise<void> => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  const authParams = token ? { token } : { key, secret };

  onStatusChange?.('fetching_itunes');

  // ── Step 1: Apple Music – fetch albums and apply strict category filter ──────
  let candidates: AlbumItem[] = [];
  try {
    const res = await axios.get('https://itunes.apple.com/search', {
      params: { term: query, entity: 'album', limit: 200 }
    });

    const raw: any[] = res.data.results || [];

    // Filter: must be a proper album (not single/EP bundle), at least 4 tracks,
    // and title must not look like a tribute/cover/remix album
    const albums = raw.filter((item) =>
      item.collectionType === 'Album' &&
      item.trackCount >= 4 &&
      !NOISE_PATTERN.test(item.collectionName)
    );

    candidates = albums.map((item) => ({
      id: item.collectionId,
      title: item.collectionName,
      artist: item.artistName,
      thumb: item.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
      year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
      genre: [item.primaryGenreName],
    }));
  } catch (e) {
    console.error('iTunes search failed:', e);
    onStatusChange?.('done', 0);
    return;
  }

  if (candidates.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  // Cap at 20 to stay within Discogs rate limit
  const toCheck = candidates.slice(0, 20);
  onStatusChange?.('validating', toCheck.length);

  // ── Step 2: Discogs – verify each album has an LP release ───────────────────
  const CONCURRENCY = 3;

  const verify = async (album: AlbumItem) => {
    try {
      const cleanTitle = album.title
        .replace(/ - EP$| - Single$/i, '')
        .replace(/\s*\(.*?\)\s*/g, '')  // remove parenthetical suffixes
        .trim();

      // Try exact title match first (most accurate)
      let dRes = await axios.get('https://api.discogs.com/database/search', {
        params: {
          release_title: cleanTitle,
          artist: album.artist,
          ...authParams,
          type: 'release',
          format: 'vinyl',
        },
        headers: { 'User-Agent': 'VinylA/1.0.0' }
      });

      let hit = dRes.data.results?.[0];

      // Fallback: try with original query as artist name (Korean/English mismatch fix)
      if (!hit) {
        dRes = await axios.get('https://api.discogs.com/database/search', {
          params: {
            release_title: cleanTitle,
            artist: query,
            ...authParams,
            type: 'release',
            format: 'vinyl',
          },
          headers: { 'User-Agent': 'VinylA/1.0.0' }
        });
        hit = dRes.data.results?.[0];
      }

      if (hit) {
        // Use Discogs master_id if available for accurate tracklist fetching later
        onItem({
          ...album,
          id: hit.master_id || hit.id || album.id,
        });
      }
      // No LP found → silently skip (don't surface digital-only or singles)
    } catch (e: any) {
      console.warn(`Discogs verify failed for "${album.title}":`, e.message);
      // On API error (e.g. rate limit), surface the album anyway
      onItem(album);
    }
  };

  for (let i = 0; i < toCheck.length; i += CONCURRENCY) {
    await Promise.all(toCheck.slice(i, i + CONCURRENCY).map(verify));
  }

  onStatusChange?.('done');


// ─── NEW: Discogs-first search ────────────────────────────────────────────────
// Strategy:
//   1. Search Discogs directly for LP/Vinyl releases → guaranteed real vinyl results
//   2. Deduplicate by master_id (same album reissued many times → one card)
//   3. Enrich cover art from Apple Music (Discogs thumbs are often missing/low-res)
//
// Why Discogs-first?
//   Apple Music returns singles-heavy results for prolific artists.
//   Discogs `format=LP` gives us only actual LPs from the start.
// ─────────────────────────────────────────────────────────────────────────────

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

  // ── Step 1: Fetch 3 pages in parallel → 150 results to dedup from ──────────
  // Reason: For popular artists (e.g. Radiohead), 50 results is dominated by many
  // reissues of the same 4-5 albums. Fetching 3 pages gives us enough raw material
  // to extract 10-15 truly distinct LPs after deduplication.
  let discogsResults: any[] = [];
  try {
    const pages = await Promise.all([1, 2, 3].map((page) =>
      axios.get('https://api.discogs.com/database/search', {
        params: {
          q: query,
          ...authParams,
          type: 'release',
          format: 'LP',
          per_page: 50,
          page,
          sort: 'want',
          sort_order: 'desc',
        },
        headers: { 'User-Agent': 'VinylA/1.0.0' }
      }).then(r => r.data.results || []).catch(() => [])
    ));
    discogsResults = pages.flat();
  } catch (e) {
    console.error('Discogs search failed:', e);
    onStatusChange?.('done', 0);
    return;
  }

  if (discogsResults.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  // ── Step 2: Deduplicate by master_id across all 150 results ─────────────────
  const seenMasters = new Set<number>();
  const seenTitles = new Set<string>();
  const unique: any[] = [];

  for (const r of discogsResults) {
    if (r.master_id && seenMasters.has(r.master_id)) continue;
    const normTitle = (r.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenTitles.has(normTitle)) continue;

    if (r.master_id) seenMasters.add(r.master_id);
    seenTitles.add(normTitle);
    unique.push(r);

    if (unique.length >= 15) break;
  }

  onStatusChange?.('enriching', unique.length);

  // ── Step 3: Enrich each LP with Apple Music cover art (3 at a time) ────────
  const CONCURRENCY = 3;

  const enrich = async (r: any) => {
    // Parse "Artist - Title" format from Discogs
    const rawTitle = r.title || '';
    let artist = '';
    let title = rawTitle;
    if (rawTitle.includes(' - ')) {
      const parts = rawTitle.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    // Use Discogs image first; fall back to Apple Music
    let thumb = r.cover_image || r.thumb || '';

    if (!thumb || thumb.includes('spacer')) {
      // Try Apple Music for a better cover image
      try {
        const itRes = await axios.get('https://itunes.apple.com/search', {
          params: { term: `${artist} ${title}`, entity: 'album', limit: 1 }
        });
        const hit = itRes.data.results?.[0];
        if (hit) thumb = hit.artworkUrl100?.replace('100x100bb', '600x600bb') || thumb;
      } catch (_) { /* ignore, use Discogs thumb */ }
    }

    const album: AlbumItem = {
      id: r.master_id || r.id,     // Prefer master_id for stable tracklist lookups
      title,
      artist,
      thumb,
      year: r.year ? String(r.year) : '',
      format: r.format || ['Vinyl', 'LP'],
    };

    onItem(album);
  };

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(enrich));
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

