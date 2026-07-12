import { NextRequest, NextResponse } from 'next/server';
import { parseAppleMusicTracks } from '@vinyla/core-api';

// Extracts the tracklist a streaming-only album embeds in its public
// music.apple.com page (schema.org ld+json). The free iTunes lookup API
// returns no track entities for albums not sold on the iTunes Store, and
// Korean indie releases are often missing from Deezer too — the album page
// is the last keyless source, and it carries original-language titles.
// Browser bundles can't fetch the page cross-origin, so this route does it
// server-side. Keyless and read-only; the id is validated as numeric.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const res = await fetch(`https://music.apple.com/kr/album/${id}`, {
      headers: {
        // music.apple.com serves an empty body without a real browser UA
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return NextResponse.json({ tracks: [] });
    const tracks = parseAppleMusicTracks(await res.text());
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
