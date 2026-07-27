import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for Discogs search so the token/key never ships in a
// client bundle. Client sends only the whitelisted search params; the fixed
// vinyl-search params and credentials are appended here.
const ALLOWED_PARAMS = ['q', 'artist', 'release_title', 'track', 'genre', 'style', 'page'] as const;

// `format` is client-selectable but only from this fixed menu — the proxy is
// public, so an arbitrary passthrough would let anyone turn it into a general
// Discogs search relay. "Compilation Vinyl" scopes an artist search to their
// compilation/best-of vinyl, which the want-sorted plain search buries under
// hundreds of studio-album pressings (e.g. Michael Jackson "Number Ones").
const ALLOWED_FORMATS = ['vinyl', 'Compilation Vinyl'] as const;

const getDiscogsAuth = (): Record<string, string> | null => {
  if (process.env.DISCOGS_TOKEN) return { token: process.env.DISCOGS_TOKEN };
  if (process.env.DISCOGS_KEY && process.env.DISCOGS_SECRET) {
    return { key: process.env.DISCOGS_KEY, secret: process.env.DISCOGS_SECRET };
  }
  return null;
};

export async function GET(request: NextRequest) {
  const auth = getDiscogsAuth();
  if (!auth) {
    return NextResponse.json({ error: 'discogs not configured' }, { status: 500 });
  }

  const url = new URL('https://api.discogs.com/database/search');
  for (const key of ALLOWED_PARAMS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) url.searchParams.set(key, value.slice(0, 200));
  }
  const requestedFormat = request.nextUrl.searchParams.get('format');
  const format = ALLOWED_FORMATS.includes(requestedFormat as (typeof ALLOWED_FORMATS)[number])
    ? (requestedFormat as string)
    : 'vinyl';
  url.searchParams.set('type', 'release');
  url.searchParams.set('format', format);
  url.searchParams.set('per_page', '50');
  url.searchParams.set('sort', 'want');
  url.searchParams.set('sort_order', 'desc');
  for (const [k, v] of Object.entries(auth)) url.searchParams.set(k, v);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'VinylA/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404) return NextResponse.json({ results: [] });
    if (!res.ok) {
      return NextResponse.json({ error: 'discogs error' }, { status: res.status === 429 ? 429 : 502 });
    }
    const data = await res.json();
    return NextResponse.json({ results: data.results || [] });
  } catch {
    return NextResponse.json({ error: 'discogs unreachable' }, { status: 502 });
  }
}
