import { NextRequest, NextResponse } from 'next/server';

// Free-text album search against the keyless iTunes Search API, used by the
// community album registration flow to auto-pull a cover + let the user pick
// a candidate before fetching its full tracklist (via the existing
// apple-tracks route, keyed by collectionId — kept as a separate round trip
// so a single search doesn't fan out into N music.apple.com page fetches).
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get('term');
  if (!term || !term.trim()) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term.slice(0, 200));
  url.searchParams.set('entity', 'album');
  url.searchParams.set('country', 'KR');
  url.searchParams.set('limit', '15');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return NextResponse.json({ error: 'itunes error' }, { status: res.status === 429 ? 429 : 502 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      collectionId: r.collectionId,
      artistName: r.artistName || '',
      collectionName: r.collectionName || '',
      artworkUrl: typeof r.artworkUrl100 === 'string' ? r.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      releaseYear: typeof r.releaseDate === 'string' ? Number(r.releaseDate.slice(0, 4)) || undefined : undefined,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'itunes unreachable' }, { status: 502 });
  }
}
