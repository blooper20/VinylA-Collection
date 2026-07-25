import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for Discogs master/release details (tracklist, notes,
// lowest price) so the token never ships in a client bundle.
const getDiscogsAuthQuery = (): string | null => {
  if (process.env.DISCOGS_TOKEN) return `token=${encodeURIComponent(process.env.DISCOGS_TOKEN)}`;
  if (process.env.DISCOGS_KEY && process.env.DISCOGS_SECRET) {
    return `key=${encodeURIComponent(process.env.DISCOGS_KEY)}&secret=${encodeURIComponent(process.env.DISCOGS_SECRET)}`;
  }
  return null;
};

const fetchDiscogs = async (path: string, authQuery: string) => {
  const res = await fetch(`https://api.discogs.com/${path}?${authQuery}`, {
    headers: { 'User-Agent': 'VinylA/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  return res.json();
};

export async function GET(request: NextRequest) {
  const authQuery = getDiscogsAuthQuery();
  if (!authQuery) {
    return NextResponse.json({ error: 'discogs not configured' }, { status: 500 });
  }

  const releaseId = request.nextUrl.searchParams.get('releaseId');
  const albumId = request.nextUrl.searchParams.get('albumId');

  try {
    let data: any = null;
    if (releaseId && /^\d+$/.test(releaseId)) {
      // The user's exact physical pressing — ground truth for tracks/sides.
      data = await fetchDiscogs(`releases/${releaseId}`, authQuery);
    } else if (albumId && /^\d+$/.test(albumId)) {
      // No known release id: fall back to the master's "representative"
      // tracklist, then a plain release lookup if it isn't a master at all.
      data =
        (await fetchDiscogs(`masters/${albumId}`, authQuery)) ??
        (await fetchDiscogs(`releases/${albumId}`, authQuery));
    } else {
      return NextResponse.json({ error: 'invalid albumId/releaseId' }, { status: 400 });
    }

    if (!data) return NextResponse.json({ tracklist: [] });

    return NextResponse.json({
      // Raw tracklist (with `position` intact, e.g. "A1"/"B2") — the client
      // parses position into side, since only it knows whether this came
      // from an exact release (has sides) or a fallback source.
      tracklist: Array.isArray(data.tracklist) ? data.tracklist : [],
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      lowest_price: typeof data.lowest_price === 'number' ? data.lowest_price : undefined,
    });
  } catch {
    return NextResponse.json({ tracklist: [] });
  }
}
