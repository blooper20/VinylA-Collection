import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for a Discogs master's version list (real physical
// pressings behind the abstract master group) so the token never ships in
// a client bundle. Used by the "pressing picker" UI — a master's search
// card auto-picks one release, but the user's actual copy may be a
// different pressing with different bonus tracks/sides.
const getDiscogsAuthQuery = (): string | null => {
  if (process.env.DISCOGS_TOKEN) return `token=${encodeURIComponent(process.env.DISCOGS_TOKEN)}`;
  if (process.env.DISCOGS_KEY && process.env.DISCOGS_SECRET) {
    return `key=${encodeURIComponent(process.env.DISCOGS_KEY)}&secret=${encodeURIComponent(process.env.DISCOGS_SECRET)}`;
  }
  return null;
};

export async function GET(request: NextRequest) {
  const authQuery = getDiscogsAuthQuery();
  if (!authQuery) {
    return NextResponse.json({ error: 'discogs not configured' }, { status: 500 });
  }

  const masterId = request.nextUrl.searchParams.get('masterId');
  if (!masterId || !/^\d+$/.test(masterId)) {
    return NextResponse.json({ error: 'invalid masterId' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.discogs.com/masters/${masterId}/versions?${authQuery}&format=Vinyl&per_page=50`,
      { headers: { 'User-Agent': 'VinylA/1.0' }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return NextResponse.json({ versions: [] });
    const data = await res.json();
    return NextResponse.json({ versions: Array.isArray(data.versions) ? data.versions : [] });
  } catch {
    return NextResponse.json({ versions: [] });
  }
}
