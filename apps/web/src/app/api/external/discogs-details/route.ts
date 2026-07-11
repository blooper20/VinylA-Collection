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

  const albumId = request.nextUrl.searchParams.get('albumId');
  if (!albumId || !/^\d+$/.test(albumId)) {
    return NextResponse.json({ error: 'invalid albumId' }, { status: 400 });
  }

  try {
    // Albums are stored under their master id when available, so try the
    // master endpoint first and fall back to a release lookup.
    const data =
      (await fetchDiscogs(`masters/${albumId}`, authQuery)) ??
      (await fetchDiscogs(`releases/${albumId}`, authQuery));

    if (!data) return NextResponse.json({ tracks: [] });

    return NextResponse.json({
      tracks: Array.isArray(data.tracklist) ? data.tracklist.map((t: { title: string }) => t.title) : [],
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      lowest_price: typeof data.lowest_price === 'number' ? data.lowest_price : undefined,
    });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
