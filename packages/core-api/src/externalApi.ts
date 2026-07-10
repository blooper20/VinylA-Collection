import axios from 'axios';
import axiosRetry from 'axios-retry';
import { AppError } from './errors';

// Configure axios to retry requests on failure (e.g. rate limits, network issues)
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
import { logEvent } from './events';

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

export interface DiscogsRelease {
  id: number;
  master_id?: number;
  title?: string;
  year?: string | number;
  format?: string[];
  genre?: string[];
  style?: string[];
  country?: string;
  thumb?: string;
  cover_image?: string;
}

export interface ITunesResult {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  copyright?: string;
  trackName?: string;
  wrapperType?: string;
}

export interface YouTubeResult {
  id: { videoId: string };
  snippet: { title: string; description: string; thumbnails: Record<string, unknown> };
}

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

export type DiscogsSearchSession = {
  // Fetches the next batch (~20 LPs), streaming each via onItem.
  // Resolves false once the result set is exhausted (or on error).
  loadMore: () => Promise<boolean>;
};

export const createDiscogsSearchSession = (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number, error?: AppError) => void
): DiscogsSearchSession => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  const key = process.env.EXPO_PUBLIC_DISCOGS_KEY || process.env.NEXT_PUBLIC_DISCOGS_KEY;
  const secret = process.env.EXPO_PUBLIC_DISCOGS_SECRET || process.env.NEXT_PUBLIC_DISCOGS_SECRET;
  const authParams = token ? { token } : { key, secret };
  const isGenreQuery = query.startsWith('#');

  // State persisting across batches so paging never re-shows the same LP.
  const seenMasters = new Set<number>();
  const seenTitles = new Set<string>();
  let batch = 0;
  let cumulativeTotal = 0;
  let exhausted = false;
  let aliasPromise: Promise<string> | null = null;

  // Random starting offset keeps genre clicks feeling fresh between sessions,
  // while pages advance sequentially *within* a session for stable paging.
  const genrePageBase = Math.floor(Math.random() * 5);

  // ── Step 0: Extract English Alias via iTunes (for Korean artist names) ───────
  // E.g. "웨이브투어스" -> "wave to earth", "검정치마" -> "The Black Skirts"
  // Resolved once per session, reused by every batch.
  const resolveAlias = async (): Promise<string> => {
    try {
      const itRes = await axios.get('https://itunes.apple.com/search', {
        params: { term: query, entity: 'musicArtist', limit: 3 }
      });
      const artistName = itRes.data.results?.[0]?.artistName;
      if (artistName && artistName.toLowerCase() !== query.toLowerCase()) {
        return artistName;
      }
    } catch (e) { /* ignore */ }
    return '';
  };

  const loadMore = async (): Promise<boolean> => {
    if (exhausted || !query.trim()) return false;

    onStatusChange?.('fetching_discogs');

    if (!aliasPromise) aliasPromise = isGenreQuery ? Promise.resolve('') : resolveAlias();
    const alias = await aliasPromise;

    // ── Step 1: Discogs vinyl search (two parallel pages per batch) ────────────
    let raw: DiscogsRelease[] = [];
    try {
      const fetchPage = async (params: Record<string, unknown>) => {
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
        let discogsParams: Record<string, string> = {};
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

        const page1 = genrePageBase + batch * 2 + 1;
        promises.push(
          fetchPage({ ...discogsParams, page: page1 }),
          fetchPage({ ...discogsParams, page: page1 + 1 })
        );
      } else {
        // Original query text search
        const page1 = batch * 2 + 1;
        promises.push(fetchPage({ q: query, page: page1 }), fetchPage({ q: query, page: page1 + 1 }));
        // If we found an English alias, do an exact ARTIST search to avoid noise
        if (alias) {
          promises.push(fetchPage({ artist: alias, page: batch + 1 }));
        }
      }

      const pages = await Promise.all(promises);
      raw = pages.flat();
    } catch (e: unknown) {
      const err = e as Error;
      console.error('Discogs search failed:', err?.message || 'Unknown error');
      const appErr = new AppError('EXT-001', 'Discogs 검색 중 오류가 발생했습니다.', e);
      onStatusChange?.('error', cumulativeTotal, appErr);
      return false;
    }

    // Usage metric: one SEARCH event per session, on the first batch only
    if (batch === 0) {
      logEvent('SEARCH', { query: query.slice(0, 100), isGenre: isGenreQuery });
    }

    if (raw.length === 0) {
      exhausted = true;
      onStatusChange?.('done', cumulativeTotal);
      return false;
    }

    // ── Step 2: Client-side filter → LP/Album formats + artist must match query ──
    const unique: { r: DiscogsRelease, isFeature: boolean }[] = [];
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

      // Stop if we have enough of both main and featured albums (max 20 per batch)
      if (unique.length >= 20) break;
    }

    if (unique.length === 0) {
      exhausted = true;
      onStatusChange?.('done', cumulativeTotal);
      return false;
    }

    cumulativeTotal += unique.length;
    onStatusChange?.('enriching', cumulativeTotal);

    // ── Step 3: Enrich each LP with Apple Music cover art (3 concurrent) ────────
    const CONCURRENCY = 3;

    const enrich = async ({ r, isFeature }: { r: DiscogsRelease, isFeature: boolean }) => {
      const { artist, title } = parseDiscogsTitle(r.title || '');

      // 1. Unconditionally try Apple Music for a pristine digital cover
      let thumb = '';
      let hit: ITunesResult | null = null;
      try {
        const cleanArtist = artist.replace(/\s\(\d+\)$/, '').trim();
        const cleanTitle = title.split(' / ')[0].split('(')[0].trim();

        const itRes = await axios.get('https://itunes.apple.com/search', {
          params: { term: `${cleanArtist} ${cleanTitle}`, entity: 'album', limit: 3 }
        });
        // Pick the Apple Music result whose artist or title best matches
        hit = itRes.data.results?.find((item: ITunesResult) => {
          const itemArtist = item.artistName?.toLowerCase() || '';
          const itemTitle = item.collectionName?.toLowerCase() || '';
          const qArtist = cleanArtist.toLowerCase();
          const qTitle = cleanTitle.toLowerCase();

          const artistMatch = (!isGenreQuery && itemArtist.includes(query.toLowerCase())) ||
                              itemArtist.includes(qArtist) ||
                              qArtist.includes(itemArtist) ||
                              (alias && itemArtist.includes(alias.toLowerCase()));
          const titleMatch = itemTitle.includes(qTitle) || qTitle.includes(itemTitle);

          return artistMatch && titleMatch;
        });

        // 만약 Apple Music에 정확히 일치하는 아티스트나 앨범이 없다면 엉뚱한 커버(예: 피켓전도뮤직 1집)를
        // 가져오는 대참사가 발생하므로, 무조건 첫 번째 결과를 믿는 로직을 완전히 삭제합니다!
        // 일치하는 항목이 없을 때는 안전하게 Discogs 원본 커버로 Fallback 되도록 둡니다.
        if (hit?.artworkUrl100) {
          thumb = hit.artworkUrl100.replace('100x100bb', '600x600bb');
        }
      } catch (e) { /* ignore */ }

      // 2. Fallback to Discogs cover image if Apple Music failed
      if (!thumb || thumb.includes('spacer.gif')) {
        thumb = r.cover_image || r.thumb || '';
      }

      // Discogs gives `genre` and `style` as arrays. We also add `country`.
      const combinedGenres = Array.from(new Set([
        ...(r.country ? [r.country] : []),
        ...(r.genre || []),
        ...(r.style || [])
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

    batch++;
    onStatusChange?.('done', cumulativeTotal);
    return true;
  };

  return { loadMore };
};

// One-shot wrapper kept for callers that only need the first batch
// (web search page, local api server).
export const searchDiscogsLazy = async (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number, error?: AppError) => void
): Promise<void> => {
  await createDiscogsSearchSession(query, onItem, onStatusChange).loadMore();
};


export interface AlbumExtraDetails {
  tracks: string[];
  notes?: string;
  copyright?: string;
  releaseDate?: string;
  highResCover?: string;
  marketPrice?: number;
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
      details.tracks = masterRes.data.tracklist.map((t: { title: string }) => t.title);
    }
    if (masterRes.data?.notes) {
      details.notes = masterRes.data.notes;
    }
    if (masterRes.data?.lowest_price) {
      details.marketPrice = Math.round(masterRes.data.lowest_price * 1400); // Convert USD/EUR to KRW roughly
    }
  } catch (e) {
    try {
      const releaseRes = await axios.get(`https://api.discogs.com/releases/${albumId}`, { params: authParams });
      if (releaseRes.data?.tracklist) {
        details.tracks = releaseRes.data.tracklist.map((t: { title: string }) => t.title);
      }
      if (releaseRes.data?.notes) {
        details.notes = releaseRes.data.notes;
      }
      if (releaseRes.data?.lowest_price) {
        details.marketPrice = Math.round(releaseRes.data.lowest_price * 1400);
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
      const hit = itRes.data.results?.find((item: ITunesResult) => {
        const itemArtist = item.artistName?.toLowerCase() || '';
        const itemTitle = item.collectionName?.toLowerCase() || '';
        const qArtist = cleanArtist.toLowerCase();
        const qTitle = cleanTitle.toLowerCase();
        
        const artistMatch = itemArtist.includes(qArtist) || qArtist.includes(itemArtist);
        const titleMatch = itemTitle.includes(qTitle) || qTitle.includes(itemTitle);
        
        return artistMatch && titleMatch;
      });
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
          const songs = trackRes.data.results?.filter((r: ITunesResult) => r.wrapperType === 'track') || [];
          if (songs.length > 0) {
            details.tracks = songs.map((s: ITunesResult) => s.trackName || '');
          }
        }
      }
    }
  } catch (e: unknown) {
    const error = e as Error;
    console.warn('iTunes extra details fetch failed:', error?.message || 'Unknown error');
  }

  return details;
};

// YouTube Data API Bridge Function
export const searchYouTube = async (query: string): Promise<string[]> => {
  const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        videoCategoryId: '10', // Music
        maxResults: 3,
        key: apiKey,
      },
    });

    if (res.data && res.data.items) {
      return res.data.items.map((item: YouTubeResult) => item.id.videoId);
    }
    return [];
  } catch (error) {
    console.error('YouTube search error:', error);
    throw new AppError('EXT-003', 'YouTube 검색 중 오류가 발생했습니다.', error);
  }
};

// Google Cloud Vision API Function
export const analyzeImageWithVisionAPI = async (base64Image: string) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
  
  if (!apiKey) {
    throw new Error('Google Vision API key is missing. Please add EXPO_PUBLIC_GOOGLE_VISION_API_KEY to your .env file.');
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
              { type: 'TEXT_DETECTION', maxResults: 10 },
              { type: 'WEB_DETECTION', maxResults: 5 }
            ],
          },
        ],
      }
    );
    return response.data.responses[0];
  } catch (e: unknown) {
    const error = e as Error & { response?: { data?: { error?: { message?: string } } } };
    console.error('Vision API failed:', error?.response?.data || error);
    throw new Error(error?.response?.data?.error?.message || 'Google Vision API request failed');
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
  } catch (e: unknown) {
    const err = e as Error;
    console.warn('Failed to fetch high quality artwork from iTunes', err?.message || 'Unknown error');
  }
  return fallbackUrl;
};

