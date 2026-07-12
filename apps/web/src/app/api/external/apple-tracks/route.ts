import { NextRequest, NextResponse } from 'next/server';
import { parseAppleMusicAlbumPage } from '@vinyla/core-api';

// Extracts the localized album name + tracklist a release embeds in its
// public music.apple.com page (schema.org ld+json). The free iTunes API
// stores the label's canonical (often English) title and returns no track
// entities for streaming-only albums — the KR page carries the Korean name
// (used to verify translated-title search candidates) and the full
// tracklist. Browser bundles can't fetch the page cross-origin, so this
// route does it server-side. Keyless and read-only; the id is validated
// as numeric.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ name: '', tracks: [] });
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
    if (!res.ok) return NextResponse.json({ name: '', tracks: [] });
    const page = parseAppleMusicAlbumPage(await res.text());
    return NextResponse.json(page ?? { name: '', tracks: [] });
  } catch {
    return NextResponse.json({ name: '', tracks: [] });
  }
}
