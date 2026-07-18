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
  categoryName?: string;
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
  // Merch listings (season's greetings, calendars) can carry an "LP" token
  // via bundled trinkets ("미니 LP 키링") without being records at all.
  !/시즌\s*그리팅|키링|달력|다이어리|굿즈/.test(title || '') &&
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
//
// Caveat: not every bracket is a format spec. Some listings put the actual
// album name in brackets after an ordinal — "2nd LP [집] [레드 마블 컬러 +
// 일반 블랙 2LP]" — so blanket-stripping every bracket left "2nd LP" as the
// title, which no music catalog can resolve. Brackets are collected while
// stripping, and if nothing but numbering remains outside them, the first
// bracket that doesn't look like a format spec is the title.
const isFormatSpecBracket = (s: string): boolean =>
  s.split(/[^A-Za-z0-9가-힣]+/).some(
    (token) => /^\d*(LP|CD|EP|DVD)$/i.test(token) || /^\d+g$/i.test(token)
  ) || /컬러|마블|한정|재발매|디스크|굿즈|Edition|Vinyl|Color|Colour/i.test(s);

// Release numbering ("정규 3집", "EP 2집", "2nd LP") — noise, never part of
// the actual title.
const ALADIN_ORDINAL = /(정규|EP|싱글)?\s*\d+\s*집|\d+(st|nd|rd|th)\s*(LP|EP|앨범)/gi;

const cleanAladinTitle = (rawTitle: string): string => {
  const raw = rawTitle || '';
  const idx = raw.indexOf(' - ');
  const rest = idx >= 0 ? raw.slice(idx + 3) : raw;

  const brackets: string[] = [];
  const base = rest
    .replace(/\[([^\]]*)\]/g, (_m, inner: string) => {
      brackets.push(inner.trim());
      return ' ';
    })
    .split(' - ')[0] // drop trailing packaging notes after a second " - "
    .replace(ALADIN_ORDINAL, ' ')
    // Edition designations glued to the title ("실리카겔 일반반") — commerce
    // noise, never part of the album name.
    .replace(/일반반|한정반|합본반|초도한정반/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (base) return base;

  return brackets.find((b) => b && !isFormatSpecBracket(b)) || '';
};

// Aladin's ItemSearch returns small covers (a /coversum/ or /cover200/ path
// segment in the image URL). The same image is also hosted under /cover500/
// (500×500 — the largest variant Aladin serves; cover1000 etc. 404). Swapping
// the path segment is the only way to get it, since no API parameter goes
// above 200px. Verified live against image.aladin.co.kr before relying on it.
const upgradeAladinCover = (url?: string): string =>
  (url || '').replace(/\/cover\w*\//, '/cover500/').replace(/^http:\/\//i, 'https://');

// Compilation listings put every participating artist in `author`
// ("강승원, 선우정아, 아이유 (IU), … 여러 아티스트 (Various Artists)") —
// carried whole, that list poisons every downstream search term and makes
// artist matching impossible. The first listed artist is the primary one
// (project albums list the project owner first); catalog entries filed
// under "Various Artists" are handled by the matchers (see
// isVariousArtistsName).
const primaryAladinAuthor = (author?: string): string =>
  (author || '').split(',')[0].trim();

// Music catalogs file compilations under "Various Artists" (Apple ko:
// "여러 아티스트"), which no queried artist text can ever match — matchers
// treat it as an artist wildcard, gated by a title or localized-page-name
// match so it can't grab arbitrary albums.
const isVariousArtistsName = (name?: string): boolean =>
  /various artists|여러 아티스트/i.test(name || '');

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
                  categoryName: it.categoryName,
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
        const cover = upgradeAladinCover(it.cover);
        
        const ALADIN_GENRE_MAP: Record<string, string> = {
          '가요': 'K-Pop', '록': 'Rock', '팝': 'Pop', '발라드/R&B': 'R&B / Soul', '인디음악': 'Indie', '힙합': 'Hip Hop',
          'O.S.T.': 'Soundtrack', '애니메이션': 'Soundtrack', '포크음악': 'Folk', '영화음악': 'Soundtrack', '재즈/블루스': 'Jazz',
          '해외구매': '', 'J-POP': 'J-Pop', '클래식': 'Classical', '뉴에이지': 'New Age', '국악': 'World', '동요/태교': '',
          '종교/명상': 'Ambient', '팝/포크': 'Pop', '팝페라': 'Crossover', '크로스오버': 'Crossover', '랩/힙합': 'Hip Hop',
          '재즈': 'Jazz', '블루스': 'Blues', '일렉트로니카': 'Electronic', '헤비메탈': 'Heavy Metal', '하드록': 'Hard Rock',
          '모던록': 'Modern Rock', '펑크': 'Punk', '소울': 'R&B / Soul', 'R&B': 'R&B / Soul', '월드뮤직': 'World', '라틴': 'Latin',
          '레게': 'Reggae', '보사노바': 'Bossa Nova', '샹송': 'Chanson', '칸초네': 'World', '뮤지컬': 'Musical', '사운드트랙': 'Soundtrack'
        };

        const rawGenres = (it.categoryName as string || '').split('>').map(s => {
          const trimmed = s.trim();
          return ALADIN_GENRE_MAP[trimmed] !== undefined ? ALADIN_GENRE_MAP[trimmed] : trimmed;
        }).filter(s => s && s !== '음반' && s !== '국내도서');
        
        return {
          id: ALADIN_ID_OFFSET + it.itemId,
          master_id: ALADIN_ID_OFFSET + it.itemId,
          title: `${primaryAladinAuthor(it.author)} - ${cleanTitle}`,
          year: it.pubDate ? it.pubDate.slice(0, 4) : '',
          format: ['LP'],
          thumb: cover,
          cover_image: cover,
          genre: rawGenres.length > 0 ? rawGenres : ['K-Pop'],
        };
      });
  } catch {
    return [];
  }
};

// ── Deezer: keyless fallback when the free iTunes Search API misses ────────
// Apple-Music-exclusive albums (streaming-only, never sold on the iTunes
// Store) are invisible to itunes.apple.com/search even with country=KR —
// e.g. 백예린 "Flash and Core" — yet Deezer's catalog has them, with 1000px
// covers and full tracklists, no API key required. Deezer sends no CORS
// headers though, so web-browser bundles reach it through the same-origin
// deezer-album proxy route; React Native and server contexts (no CORS
// enforcement) call api.deezer.com directly.
interface DeezerAlbumHit {
  id: number;
  title?: string;
  artist?: { name?: string };
  cover_xl?: string;
  cover_big?: string;
}

interface DeezerAlbumDetail extends DeezerAlbumHit {
  release_date?: string;
  tracks?: { data?: Array<{ title?: string }> };
}

const deezerGet = async (params: { q: string } | { id: number }): Promise<unknown> => {
  if (typeof document !== 'undefined') {
    // Web browser: no CORS from Deezer, go through the same-origin proxy
    const res = await axios.get(`${getProxyBaseUrl()}/api/external/deezer-album`, { params });
    return res.data;
  }
  const res = 'id' in params
    ? await axios.get(`https://api.deezer.com/album/${params.id}`)
    : await axios.get('https://api.deezer.com/search/album', { params: { q: params.q } });
  return res.data;
};

const searchDeezerAlbum = async (artist: string, title: string, alias?: string): Promise<DeezerAlbumHit | null> => {
  try {
    const data = (await deezerGet({ q: `${artist} ${title}`.trim() })) as { data?: DeezerAlbumHit[] };
    const candidates = Array.isArray(data?.data) ? data.data.slice(0, 5) : [];
    const qArtist = artist.toLowerCase();
    const qTitle = title.toLowerCase();
    return candidates.find((c) => {
      const cArtist = c.artist?.name?.toLowerCase() || '';
      const cTitle = c.title?.toLowerCase() || '';
      const titleMatch = !!cTitle && (cTitle.includes(qTitle) || qTitle.includes(cTitle));
      // Deezer stores romanized artist names ("백예린" → "Yerin Baek") AND
      // sometimes translated album titles ("개화" → "FLOWERING"), so one of
      // the two text matches routinely fails for Korean releases. Deezer's
      // own search already matched the full "<artist> <title>" string
      // against its localized metadata, so when it returns exactly ONE
      // candidate, either match alone is enough to trust it. With several
      // candidates, require both.
      const artistMatch = (!!qArtist && (cArtist.includes(qArtist) || qArtist.includes(cArtist))) ||
        (!!alias && cArtist.includes(alias.toLowerCase()));
      // "Various Artists" compilations pass on a title match alone (never on
      // the lone-candidate relaxation — that would let any stray compilation
      // through).
      return (titleMatch && (artistMatch || isVariousArtistsName(c.artist?.name))) ||
        (candidates.length === 1 && (titleMatch || artistMatch));
    }) ?? null;
  } catch {
    return null;
  }
};

const getDeezerAlbumDetail = async (albumId: number): Promise<DeezerAlbumDetail | null> => {
  try {
    const data = (await deezerGet({ id: albumId })) as DeezerAlbumDetail;
    return data && typeof data.id === 'number' ? data : null;
  } catch {
    return null;
  }
};

// ── Apple Music album page: localized name + tracklist source ──────────────
// The free iTunes API stores the label's canonical (often English) album
// title — 개화 comes back as "FLOWERING", 사랑을 사람으로 그린다면 as
// "If I Draw Love As A Person" — and returns no track entities at all for
// streaming-only albums (not sold on the iTunes Store). The public KR
// album page, however, embeds schema.org ld+json with the *localized*
// Korean name and the full tracklist. That makes it useful twice over:
// as the last-resort tracklist source, and to VERIFY a search candidate
// whose translated title can't be text-matched against a Korean query.
// Browsers can't fetch the page cross-origin, so they go through the
// apple-tracks proxy route; React Native and server contexts fetch it
// directly.
export interface AppleMusicAlbumPage {
  name: string;
  tracks: string[];
}

export const parseAppleMusicAlbumPage = (html: string): AppleMusicAlbumPage | null => {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      if (data && data['@type'] === 'MusicAlbum') {
        return {
          name: typeof data.name === 'string' ? data.name : '',
          tracks: Array.isArray(data.tracks)
            ? data.tracks.map((t: { name?: string }) => t?.name || '').filter(Boolean)
            : [],
        };
      }
    } catch { /* try the next ld+json block */ }
  }
  return null;
};

const fetchAppleMusicAlbumPage = async (collectionId: number): Promise<AppleMusicAlbumPage | null> => {
  try {
    if (typeof document !== 'undefined') {
      const res = await axios.get(`${getProxyBaseUrl()}/api/external/apple-tracks`, {
        params: { id: collectionId },
      });
      const d = res.data;
      if (!d || (typeof d.name !== 'string' && !Array.isArray(d.tracks))) return null;
      return {
        name: typeof d.name === 'string' ? d.name : '',
        tracks: Array.isArray(d.tracks) ? d.tracks : [],
      };
    }
    const res = await axios.get(`https://music.apple.com/kr/album/${collectionId}`, {
      headers: {
        // music.apple.com serves an empty body to clients without a real
        // browser UA (verified live) — plain axios/fetch defaults get nothing.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
    });
    return parseAppleMusicAlbumPage(String(res.data));
  } catch {
    return null;
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
        params: { term: query, entity: 'musicArtist', limit: 3, country: 'KR' }
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

      // 1. The LP source's own image is the ground truth for what the
      //    physical jacket looks like — Discogs images are photos of the
      //    actual pressing, Aladin covers are the product shot of the LP
      //    being sold. Digital storefront art (Apple/Deezer) can be a
      //    different edition's artwork, and the card must show the real
      //    LP jacket (user rule), so digital art is only a fallback for
      //    items whose source has no usable image.
      const rawSourceCover = r.cover_image || r.thumb || '';
      const sourceCover = rawSourceCover.includes('spacer.gif') ? '' : rawSourceCover;
      let thumb = sourceCover;
      let hit: ITunesResult | null = null;
      const cleanArtist = artist.replace(/\s\(\d+\)$/, '').trim();
      const cleanTitle = title.split(' / ')[0].split('(')[0].trim();
      if (!thumb) try {
        const itRes = await axios.get('https://itunes.apple.com/search', {
          params: { term: `${cleanArtist} ${cleanTitle}`, entity: 'album', limit: 3, country: 'KR' }
        });
        // Pick the Apple Music result whose artist or title best matches
        const itResults: ITunesResult[] = itRes.data.results || [];
        hit = itResults.find((item: ITunesResult) => {
          const itemArtist = item.artistName?.toLowerCase() || '';
          const itemTitle = item.collectionName?.toLowerCase() || '';
          const qArtist = cleanArtist.toLowerCase();
          const qTitle = cleanTitle.toLowerCase();

          const artistMatch = (!isGenreQuery && itemArtist.includes(query.toLowerCase())) ||
                              itemArtist.includes(qArtist) ||
                              qArtist.includes(itemArtist) ||
                              (alias && itemArtist.includes(alias.toLowerCase()));
          const titleMatch = itemTitle.includes(qTitle) || qTitle.includes(itemTitle);

          // Apple Music sometimes stores a fully English-translated title for
          // a Korean release (e.g. "눈에 보이지 않는 노래는" →
          // "The Song That Is Invisible To The Eyes Is"), which never
          // substring-matches the Korean query text. Trust a confident
          // artist match on its own when the search already returned just
          // one candidate — the term itself already disambiguated it.
          // Compilations are filed under "Various Artists"; accept those on
          // a title match alone.
          return (artistMatch && (titleMatch || itResults.length === 1)) ||
            (isVariousArtistsName(item.artistName) && titleMatch);
        }) ?? null;

        // 만약 Apple Music에 정확히 일치하는 아티스트나 앨범이 없다면 엉뚱한 커버(예: 피켓전도뮤직 1집)를
        // 가져오는 대참사가 발생하므로, 무조건 첫 번째 결과를 믿는 로직을 완전히 삭제합니다!
        // 일치하는 항목이 없을 때는 안전하게 Discogs 원본 커버로 Fallback 되도록 둡니다.
        if (hit?.artworkUrl100) {
          thumb = hit.artworkUrl100.replace('100x100bb', '600x600bb');
        }
      } catch (e) { /* ignore */ }

      // 1b. Second-line fallback for cover-less items: Apple-Music-exclusive
      // albums never appear in the free iTunes search index even with
      // country=KR (e.g. 백예린 "Flash and Core") — Deezer's keyless catalog
      // often still has them.
      if (!thumb) {
        const dz = await searchDeezerAlbum(cleanArtist, cleanTitle, alias);
        const dzCover = dz?.cover_xl || dz?.cover_big;
        if (dzCover) thumb = dzCover;
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
        params: { term: `${cleanArtist} ${cleanTitle}`, entity: 'album', limit: 3, country: 'KR' }
      });
      // Ensure the artist matches before taking the hit
      const itResults: ITunesResult[] = itRes.data.results || [];
      const qArtist = cleanArtist.toLowerCase();
      const qTitle = cleanTitle.toLowerCase();
      const artistMatches = (item: ITunesResult): boolean => {
        const itemArtist = item.artistName?.toLowerCase() || '';
        return itemArtist.includes(qArtist) || qArtist.includes(itemArtist);
      };
      let hit = itResults.find((item: ITunesResult) => {
        const itemTitle = item.collectionName?.toLowerCase() || '';
        const titleMatch = itemTitle.includes(qTitle) || qTitle.includes(itemTitle);

        // Apple Music sometimes stores a fully English-translated title for a
        // Korean release, which never substring-matches the Korean query
        // text. Trust a confident artist match alone when the search already
        // returned just one candidate. Compilations are filed under
        // "Various Artists" — accept those on a title match alone.
        return (artistMatches(item) && (titleMatch || itResults.length === 1)) ||
          (isVariousArtistsName(item.artistName) && titleMatch);
      }) ?? null;

      // When several candidates come back with translated titles (개화 →
      // "FLOWERING"), no text match can pick one — but each candidate's KR
      // album page carries the localized Korean name. Verify artist-matching
      // candidates against their own page and take the first whose localized
      // name matches the query title. The page also hands us the tracklist.
      let pageAlbum: AppleMusicAlbumPage | null = null;
      if (!hit) {
        for (const item of itResults) {
          // "Various Artists" entries are admitted here too — the localized
          // page-name check below is what gates acceptance. Singles never
          // are: we're resolving an LP, and a project's singles carry the
          // project name in their localized page titles ("이집"), which
          // would pass the name check with a one-track "tracklist".
          if (!item.collectionId || /- single$/i.test(item.collectionName || '') ||
              !(artistMatches(item) || isVariousArtistsName(item.artistName))) continue;
          const page = await fetchAppleMusicAlbumPage(item.collectionId);
          const pageName = page?.name?.toLowerCase() || '';
          if (pageName && (pageName.includes(qTitle) || qTitle.includes(pageName))) {
            hit = item;
            pageAlbum = page;
            break;
          }
        }
      }

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
        if (details.tracks.length === 0 && pageAlbum && pageAlbum.tracks.length > 0) {
          // The verify step above already fetched the page — reuse its tracks.
          details.tracks = pageAlbum.tracks;
        }
        if (details.tracks.length === 0) {
          // Fallback to iTunes tracks if Discogs failed.
          // lookup은 스트리밍 전용 앨범에서 503을 자주 뱉는다(라이브 재현) —
          // 여기서 throw가 바깥 catch로 새면 아래 앨범 페이지 폴백(실제로
          // 트랙을 들고 있는 경로)까지 건너뛰게 되므로 이 단계에서 삼킨다.
          try {
            const trackRes = await axios.get('https://itunes.apple.com/lookup', {
              params: { id: hit.collectionId, entity: 'song', country: 'KR' }
            });
            const songs = trackRes.data.results?.filter((r: ITunesResult) => r.wrapperType === 'track') || [];
            if (songs.length > 0) {
              details.tracks = songs.map((s: ITunesResult) => s.trackName || '');
            }
          } catch {
            // 앨범 페이지 폴백이 이어서 처리한다
          }
        }
        if (details.tracks.length === 0 && hit.collectionId) {
          // Streaming-only albums return no track entities from the lookup
          // above — the public album page still lists them.
          details.tracks = (await fetchAppleMusicAlbumPage(hit.collectionId))?.tracks || [];
        }
      }
    }
  } catch (e: unknown) {
    const error = e as Error;
    console.warn('iTunes extra details fetch failed:', error?.message || 'Unknown error');
  }

  // 3. Deezer fallback for whatever the two sources above couldn't provide.
  //    Aladin-sourced Korean LPs often end here with nothing: Discogs has no
  //    entry yet and the album is Apple-Music-exclusive (invisible to the
  //    free iTunes search index) — but Deezer carries the tracklist, a
  //    1000px cover, and the release date, keyless.
  if (artist && title && (details.tracks.length === 0 || !details.highResCover)) {
    const cleanArtist = artist.replace(/\s\(\d+\)$/, '').trim();
    const cleanTitle = title.split(' / ')[0].split('(')[0].trim();
    const dzHit = await searchDeezerAlbum(cleanArtist, cleanTitle);
    if (dzHit) {
      if (!details.highResCover && (dzHit.cover_xl || dzHit.cover_big)) {
        details.highResCover = dzHit.cover_xl || dzHit.cover_big;
      }
      if (details.tracks.length === 0 || !details.releaseDate) {
        const dz = await getDeezerAlbumDetail(dzHit.id);
        if (dz) {
          if (details.tracks.length === 0 && Array.isArray(dz.tracks?.data)) {
            details.tracks = dz.tracks.data
              .map((t) => t.title || '')
              .filter(Boolean);
          }
          if (!details.releaseDate && dz.release_date) {
            details.releaseDate = new Date(dz.release_date).toLocaleDateString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric'
            });
          }
        }
      }
    }
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
        limit: 1,
        country: 'KR'
      }
    });
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].artworkUrl100?.replace('100x100bb', '600x600bb') || fallbackUrl;
    }
  } catch (e: unknown) {
    const err = e as Error;
    console.warn('Failed to fetch high quality artwork from iTunes', err?.message || 'Unknown error');
  }
  // Same Apple-Music-exclusive gap as enrich(): albums missing from the free
  // iTunes search index can still have a 1000px cover on Deezer.
  const dz = await searchDeezerAlbum(artist, title);
  return dz?.cover_xl || dz?.cover_big || fallbackUrl;
};

