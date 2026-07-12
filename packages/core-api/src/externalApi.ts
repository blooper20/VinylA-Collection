import axios from 'axios';
import axiosRetry from 'axios-retry';
import { AppError } from './errors';

// Configure axios to retry requests on failure (e.g. rate limits, network issues)
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
import { logEvent } from './events';

// ── Credential handling ───────────────────────────────────────────────────
// API keys must never ship in a client bundle (the old EXPO_PUBLIC_/
// NEXT_PUBLIC_ vars were extractable from the web JS and the app binary).
// Server contexts (Next.js API routes, apps/api) provide unprefixed env
// vars and call the third-party APIs directly; clients get no credentials
// and go through the Next.js proxy routes instead.

const getDiscogsAuth = (): Record<string, string> | null => {
  if (process.env.DISCOGS_TOKEN) return { token: process.env.DISCOGS_TOKEN };
  if (process.env.DISCOGS_KEY && process.env.DISCOGS_SECRET) {
    return { key: process.env.DISCOGS_KEY, secret: process.env.DISCOGS_SECRET };
  }
  return null;
};

// Where clients reach the proxy that holds the keys:
// - web browser: same-origin Next.js API routes ('')
// - React Native: apps/mobile sets this global at startup (dev Metro host
//   or the production web URL) — a global instead of an import so this
//   shared package never pulls Expo modules into the web bundle.
export const getProxyBaseUrl = (): string =>
  (globalThis as any).__VINYLA_API_BASE__ || '';

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

// ── Aladin: supplementary source for Korean domestic LPs ──────────────────
// Discogs is crowdsourced from people who physically own the record — a
// Korean indie/pop LP that's still on pre-order (or just released) genuinely
// has no Discogs entry yet. Aladin's 음반 storefront lists pre-order and
// new-release LPs directly, filling that specific gap. Only queried for
// Korean-language, non-genre searches (see isKoreanQuery below) — English/
// genre browsing is already well covered by Discogs and querying Aladin
// there would just burn the free-tier daily quota for no benefit.
//
// ALBUM_ID is bigint in Postgres / typed `number` everywhere in the app, so
// Aladin items can't carry a string id — but they also can't reuse Discogs's
// numeric id space directly (two independent id authorities could collide).
// Offsetting well above Discogs's real id range (currently low millions)
// keeps every id numeric, unique, and reversible.
const ALADIN_ID_OFFSET = 9_000_000_000;

const getAladinAuth = (): string | null => process.env.ALADIN_TTB_KEY || null;

interface AladinItem {
  itemId: number;
  title: string;
  author: string;
  pubDate?: string;
  cover?: string;
  stockStatus?: string;
}

// Aladin's SearchTarget=Music returns every music format (CD, cassette,
// etc.) — it has no separate structured format field, but the format is
// reliably present as bracketed text in the title (e.g. "[180g White 2LP]",
// "[2CD]", "[...12\" LP]"). Split into alphanumeric tokens and check for an
// exact "(digits)LP" token — avoids both \bLP\b's false negative on "2LP"
// (digits are word characters, so there's no boundary before "L") and
// lookaround regex (unreliable on Hermes, the RN JS engine this also runs
// under via apps/mobile).
const isAladinLP = (title: string): boolean =>
  (title || '').split(/[^A-Za-z0-9]+/).some((token) => /^\d*LP$/i.test(token));

// Aladin titles carry commerce/packaging text Discogs titles don't (e.g.
// "정규 3집 Flash and Core [180g White 2LP] - Triple Gatefold Jacket") — left
// as-is, that whole string becomes the "title" half of the shared
// "Artist - Title" pipeline, which then feeds a near-useless search term
// into the Apple Music cover/tracklist lookup (enrich()) and shows a messy
// title in the UI. Strips everything after the *first* " - " (the artist
// prefix — found positionally, not by matching Aladin's separate `author`
// field text, since that sometimes differs from the title's own prefix,
// e.g. author "연정 (YEONJEONG)" vs title-prefix "연정"), then the bracketed
// spec and anything after a second " - " (packaging notes).
const cleanAladinTitle = (rawTitle: string): string => {
  const raw = rawTitle || '';
  const idx = raw.indexOf(' - ');
  const rest = idx >= 0 ? raw.slice(idx + 3) : raw;
  return rest
    .replace(/\[[^\]]*\]/g, '') // bracketed format/edition spec, e.g. "[180g White 2LP]"
    .split(' - ')[0] // drop trailing packaging notes after a second " - "
    .replace(/정규\s*\d+집/g, '') // "정규 3집" style numbering — noise, not part of the title
    .replace(/\s+/g, ' ')
    .trim();
};

const fetchAladinResults = async (query: string): Promise<DiscogsRelease[]> => {
  try {
    const ttbKey = getAladinAuth();
    const items: AladinItem[] = ttbKey
      ? await axios
          .get('https://www.aladin.co.kr/ttb/api/ItemSearch.aspx', {
            params: {
              ttbkey: ttbKey,
              Query: query.slice(0, 200),
              QueryType: 'Keyword',
              SearchTarget: 'Music',
              output: 'js',
              Version: '20131101',
              MaxResults: 20,
            },
          })
          .then((r) =>
            Array.isArray(r.data?.item)
              ? r.data.item.map((it: Record<string, unknown>) => ({
                  itemId: it.itemId,
                  title: it.title,
                  author: it.author,
                  pubDate: it.pubDate,
                  cover: it.cover,
                  stockStatus: it.stockStatus,
                }))
              : []
          )
      : await axios
          .get(`${getProxyBaseUrl()}/api/external/aladin-search`, { params: { q: query } })
          .then((r) => (Array.isArray(r.data?.items) ? r.data.items : []));

    return items
      .filter((it) => it.itemId && isAladinLP(it.title))
      .map((it): DiscogsRelease => {
        const cleanTitle = cleanAladinTitle(it.title) || it.title;
        return {
          id: ALADIN_ID_OFFSET + it.itemId,
          master_id: ALADIN_ID_OFFSET + it.itemId,
          title: `${it.author} - ${cleanTitle}`,
          year: it.pubDate ? it.pubDate.slice(0, 4) : '',
          format: ['LP'],
          thumb: it.cover || '',
          cover_image: it.cover || '',
        };
      });
  } catch {
    return [];
  }
};

export const createDiscogsSearchSession = (
  query: string,
  onItem: (album: AlbumItem) => void,
  onStatusChange?: (status: SearchStatus, total?: number, error?: AppError) => void
): DiscogsSearchSession => {
  const serverAuth = getDiscogsAuth();
  const isGenreQuery = query.startsWith('#');
  const isKoreanQuery = /[가-힣]/.test(query);

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
        const request = serverAuth
          ? axios.get('https://api.discogs.com/database/search', {
              params: {
                ...params,
                ...serverAuth,
                type: 'release',
                format: 'vinyl',
                per_page: 50,
                sort: 'want',
                sort_order: 'desc',
              },
            })
          : axios.get(`${getProxyBaseUrl()}/api/external/discogs-search`, { params });
        return request.then((r) => r.data.results || []).catch((e) => {
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
        const page1 = batch * 2 + 1;

        // Push sources in *precision* order, not just "whatever we have" —
        // Step 2's dedup loop stops once it has collected 20 unique albums,
        // and a plain keyword query can rack up dozens of coincidental,
        // unrelated matches (a short Korean query like "연정" hits old vinyl
        // credits that happen to contain that word) that would fill the cap
        // before any of the *precise* sources below are ever processed.
        //
        // 1. Exact artist-alias search — an English-aliased Discogs
        //    artist=... lookup is Discogs's own most exact match for the
        //    query; confirmed live that Discogs had a real, well-formed
        //    entry for an artist only reachable this way (plain-text search
        //    for the Korean name returned only unrelated noise).
        if (alias) {
          promises.push(fetchPage({ artist: alias, page: batch + 1 }));
        }
        // 2. Aladin — fills the Korean-domestic-release gap Discogs's own
        //    catalog has (see fetchAladinResults above). Fetched once per
        //    session, not per page (Aladin isn't paginated the same way).
        if (isKoreanQuery && batch === 0) {
          promises.push(fetchAladinResults(query));
        }
        // 3. Plain keyword search — broadest and noisiest, pushed last on
        //    purpose so it can't crowd out the more precise sources above.
        promises.push(fetchPage({ q: query, page: page1 }), fetchPage({ q: query, page: page1 + 1 }));
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
      // No early break here on purpose — `raw` is already bounded (a
      // handful of Discogs pages + at most ~20 Aladin items), so scoring
      // every candidate before capping is cheap, and doing it this way
      // means every *source* gets a fair chance at dedup regardless of
      // which array position it landed in. Breaking early here previously
      // caused two different real bugs: a broad source's noise filling the
      // cap before a later, more precise source was ever reached.
    }

    unique.splice(20); // cap display count *after* every candidate was considered

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
  const serverAuth = getDiscogsAuth();
  const details: AlbumExtraDetails = { tracks: [] };

  // 1. Try Discogs first (directly with server credentials, or through the
  //    key-holding proxy from client bundles)
  if (serverAuth) {
    try {
      const masterRes = await axios.get(`https://api.discogs.com/masters/${albumId}`, { params: serverAuth });
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
        const releaseRes = await axios.get(`https://api.discogs.com/releases/${albumId}`, { params: serverAuth });
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
  } else {
    try {
      const res = await axios.get(`${getProxyBaseUrl()}/api/external/discogs-details`, { params: { albumId } });
      if (Array.isArray(res.data?.tracks)) details.tracks = res.data.tracks;
      if (res.data?.notes) details.notes = res.data.notes;
      if (typeof res.data?.lowest_price === 'number') {
        details.marketPrice = Math.round(res.data.lowest_price * 1400); // Convert USD/EUR to KRW roughly
      }
    } catch (e) {
      // ignore — iTunes fallback below still runs
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

// YouTube Data API Bridge Function — direct with a server-side key, or via
// the key-holding proxy from client bundles.
export const searchYouTube = async (query: string): Promise<string[]> => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
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
    }

    const res = await axios.get(`${getProxyBaseUrl()}/api/external/youtube`, { params: { q: query } });
    return Array.isArray(res.data?.videoIds) ? res.data.videoIds : [];
  } catch (error) {
    console.error('YouTube search error:', error);
    throw new AppError('EXT-003', 'YouTube 검색 중 오류가 발생했습니다.', error);
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

