import axios from 'axios';

export type AlbumItem = {
  id: number | string;
  title: string;
  artist: string;
  thumb: string;
  year: string;
  genre?: string[];
  format?: string[];
  isFeature?: boolean;
};

export type SearchStatus = 'idle' | 'fetching_discogs' | 'enriching' | 'done' | 'error';

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

const isAlbumFormat = (formats: string[]): boolean => {
  const f = formats.map((s) => s.toLowerCase());
  
  // Exclude strict singles unless they are 12" maxis
  if (f.includes('single') && !f.includes('12"')) return false;
  if (f.includes('7"') && !f.includes('lp') && !f.includes('album') && !f.includes('ep')) return false;
  
  // Allow if it contains LP, Album, EP, Mini-Album, or 12"
  return f.includes('lp') || f.includes('album') || f.includes('ep') || f.includes('mini-album') || f.includes('12"');
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
  const isGenreQuery = query.startsWith('#');

  onStatusChange?.('fetching_discogs');

  // ── Step 0: Extract English Alias via iTunes (for Korean artist names) ───────
  // E.g. "웨이브투어스" -> "wave to earth", "검정치마" -> "The Black Skirts"
  let alias = '';
  try {
    const itRes = await axios.get('https://itunes.apple.com/search', {
      params: { term: query, entity: 'musicArtist', limit: 3 }
    });
    const artistName = itRes.data.results?.[0]?.artistName;
    if (artistName && artistName.toLowerCase() !== query.toLowerCase()) {
      alias = artistName;
    }
  } catch (e) { /* ignore */ }

  // ── Step 1: Discogs vinyl search (parallel pages) ──────────────────────────
  let raw: any[] = [];
  try {
    const fetchPage = async (params: any) => {
      return axios.get('https://api.discogs.com/database/search', {
        params: {
          ...params,
          ...authParams,
          type: 'release',
          format: 'vinyl',
          per_page: 50,
          sort: 'want',
          sort_order: 'desc',
        },
      }).then((r) => r.data.results || []).catch((e) => { 
        if (e.response && e.response.status === 404) return [];
        throw e; 
      });
    };

    const promises = [];

    if (isGenreQuery) {
      const genreKeyword = query.substring(1);
      
      // Map UI categories to correct Discogs parameters
      let discogsParams: any = {};
      switch (genreKeyword) {
        case 'Ambient': discogsParams = { style: 'Ambient' }; break;
        case 'Cinematic': discogsParams = { style: 'Soundtrack' }; break; // Stage & Screen / Soundtrack
        case 'Soul & Funk': discogsParams = { genre: 'Funk / Soul' }; break;
        case 'World': discogsParams = { genre: 'Folk, World, & Country' }; break;
        case 'Electronic': discogsParams = { genre: 'Electronic' }; break;
        case 'Jazz': discogsParams = { genre: 'Jazz' }; break;
        case 'Classical': discogsParams = { genre: 'Classical' }; break;
        case 'Rock': discogsParams = { genre: 'Rock' }; break;
        default: discogsParams = { genre: genreKeyword }; break;
      }

      // Fetch two random pages (1~10) of this category to give diverse results on each click
      const randomPage1 = Math.floor(Math.random() * 10) + 1;
      const randomPage2 = Math.floor(Math.random() * 10) + 11;
      promises.push(
        fetchPage({ ...discogsParams, page: randomPage1 }), 
        fetchPage({ ...discogsParams, page: randomPage2 })
      );
    } else {
      // Original query text search
      promises.push(fetchPage({ q: query, page: 1 }), fetchPage({ q: query, page: 2 }));
      // If we found an English alias, do an exact ARTIST search to avoid noise
      if (alias) {
        promises.push(fetchPage({ artist: alias, page: 1 }));
      }
    }

    const pages = await Promise.all(promises);
    raw = pages.flat();
  } catch (e: any) {
    console.error('Discogs search failed:', e?.message || 'Unknown error');
    onStatusChange?.('error', 0);
    return;
  }

  if (raw.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  // ── Step 2: Client-side filter → LP/Album formats + artist must match query ──
  const seenMasters = new Set<number>();
  const seenTitles = new Set<string>();
  const unique: { r: any, isFeature: boolean }[] = [];
  const queryLower = query.toLowerCase();
  const aliasLower = alias.toLowerCase();
  const isKoreanQuery = /[가-힣]/.test(query);

  for (const r of raw) {
    const formats: string[] = r.format || [];
    if (!isAlbumFormat(formats)) continue; // skip 7" singles, 12" EPs etc.

    // Discogs title format: "Artist - Album Title"
    const { artist: releaseArtist } = parseDiscogsTitle(r.title || '');
    const relArtLower = releaseArtist?.toLowerCase() || '';
    
    // Check if the artist matches the original query or the Apple Music alias
    const matchesQuery = isGenreQuery || relArtLower.includes(queryLower);
    const matchesAlias = aliasLower ? relArtLower.includes(aliasLower) : false;
    const isFeature = isGenreQuery ? false : (releaseArtist ? !(matchesQuery || matchesAlias) : false);

    const normTitle = (r.title || '').toLowerCase().replace(/\s+/g, ' ').trim();

    // Aggressive noise filtering for English queries:
    // If it's marked as a feature, but the query is English, Discogs often returns random junk 
    // (e.g. searching "wave to earth" returns "Kate Bush" because "earth" is in a track name).
    // We discard these false features. Korean queries are safer and true features (e.g. 검정치마 in credits).
    if (isFeature && !isKoreanQuery && !isGenreQuery) {
      if (!normTitle.includes(queryLower) && !(aliasLower && normTitle.includes(aliasLower))) {
        continue;
      }
    }

    if (r.master_id && r.master_id !== 0 && seenMasters.has(r.master_id)) continue;
    if (seenTitles.has(normTitle)) continue;

    if (r.master_id && r.master_id !== 0) seenMasters.add(r.master_id);
    seenTitles.add(normTitle);
    unique.push({ r, isFeature });

    // Stop if we have enough of both main and featured albums (max 20 total)
    if (unique.length >= 20) break;
  }

  if (unique.length === 0) {
    onStatusChange?.('done', 0);
    return;
  }

  onStatusChange?.('enriching', unique.length);

  // ── Step 3: Enrich each LP with Apple Music cover art (3 concurrent) ────────
  const CONCURRENCY = 3;

  const enrich = async ({ r, isFeature }: { r: any, isFeature: boolean }) => {
    const { artist, title } = parseDiscogsTitle(r.title || '');

    // 1. Unconditionally try Apple Music for a pristine digital cover
    let thumb = '';
    try {
      const cleanArtist = artist.replace(/\s\(\d+\)$/, '').trim();
      const cleanTitle = title.split(' / ')[0].split('(')[0].trim();

      const itRes = await axios.get('https://itunes.apple.com/search', {
        params: { term: `${cleanArtist} ${cleanTitle}`, entity: 'album', limit: 3 }
      });
      // Pick the Apple Music result whose artist best matches
      const hit = itRes.data.results?.find((item: any) =>
        (!isGenreQuery && item.artistName?.toLowerCase().includes(query.toLowerCase())) ||
        item.artistName?.toLowerCase().includes(cleanArtist.toLowerCase()) ||
        cleanArtist.toLowerCase().includes(item.artistName?.toLowerCase()) ||
        (alias && item.artistName?.toLowerCase().includes(alias.toLowerCase()))
      );

      if (hit?.artworkUrl100) {
        thumb = hit.artworkUrl100.replace('100x100bb', '600x600bb');
      }
    } catch (e) { /* ignore */ }

    // 2. Fallback to Discogs cover image if Apple Music failed
    if (!thumb || thumb.includes('spacer.gif')) {
      thumb = r.cover_image || r.thumb || '';
    }

    // Discogs typically gives `genre` and `style` as arrays. Combine them to get rich tags.
    const combinedGenres = Array.from(new Set([
      ...(r.genre || []),
      ...(r.style || []),
      ...(r.country ? [r.country] : [])
    ]));

    onItem({
      id: r.master_id || r.id,
      title,
      artist,
      thumb,
      year: r.year ? String(r.year) : '',
      format: r.format || ['Vinyl', 'LP'],
      genre: combinedGenres,
      isFeature,
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


export interface AlbumExtraDetails {
  tracks: string[];
  notes?: string;
  copyright?: string;
  releaseDate?: string;
  highResCover?: string;
}

export const getAlbumExtraDetails = async (albumId: string | number, artist?: string, title?: string): Promise<AlbumExtraDetails> => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  const authParams = token ? { token } : { key, secret };

  const details: AlbumExtraDetails = { tracks: [] };

  // 1. Try Discogs first
  try {
    const masterRes = await axios.get(`https://api.discogs.com/masters/${albumId}`, { params: authParams });
    if (masterRes.data?.tracklist) {
      details.tracks = masterRes.data.tracklist.map((t: any) => t.title);
    }
    if (masterRes.data?.notes) {
      details.notes = masterRes.data.notes;
    }
  } catch (e) {
    try {
      const releaseRes = await axios.get(`https://api.discogs.com/releases/${albumId}`, { params: authParams });
      if (releaseRes.data?.tracklist) {
        details.tracks = releaseRes.data.tracklist.map((t: any) => t.title);
      }
      if (releaseRes.data?.notes) {
        details.notes = releaseRes.data.notes;
      }
    } catch (e2) {
      // ignore
    }
  }

  // 2. Fetch extra details from iTunes (copyright, exact release date, highResCover)
  try {
    if (artist && title) {
      const cleanArtist = artist.replace(/\s\(\d+\)$/, '').trim();
      const cleanTitle = title.split(' / ')[0].split('(')[0].trim();

      const itRes = await axios.get('https://itunes.apple.com/search', {
        params: { term: `${cleanArtist} ${cleanTitle}`, entity: 'album', limit: 3 }
      });
      // Ensure the artist matches before taking the hit
      const hit = itRes.data.results?.find((item: any) =>
        item.artistName?.toLowerCase().includes(cleanArtist.toLowerCase()) ||
        cleanArtist.toLowerCase().includes(item.artistName?.toLowerCase())
      );
      if (hit) {
        details.copyright = hit.copyright;
        if (hit.artworkUrl100) {
          details.highResCover = hit.artworkUrl100.replace('100x100bb', '600x600bb');
        }
        if (hit.releaseDate) {
          details.releaseDate = new Date(hit.releaseDate).toLocaleDateString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric'
          });
        }
        if (details.tracks.length === 0) {
          // Fallback to iTunes tracks if Discogs failed
          const trackRes = await axios.get('https://itunes.apple.com/lookup', {
            params: { id: hit.collectionId, entity: 'song' }
          });
          const songs = trackRes.data.results?.filter((r: any) => r.wrapperType === 'track') || [];
          if (songs.length > 0) {
            details.tracks = songs.map((s: any) => s.trackName);
          }
        }
      }
    }
  } catch (error: any) {
    console.warn('iTunes extra details fetch failed:', error?.message || 'Unknown error');
  }

  return details;
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
  } catch (error: any) {
    console.warn('YouTube search failed:', error?.message || 'Unknown error');
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
  } catch (e: any) {
    console.warn('Failed to fetch high quality artwork from iTunes', e?.message || 'Unknown error');
  }
  return fallbackUrl;
};

