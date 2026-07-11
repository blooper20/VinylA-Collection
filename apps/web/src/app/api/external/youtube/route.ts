import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for the YouTube Data API so the key never ships in a
// client bundle. Returns only the video ids the app actually uses.
export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ videoIds: [] });

  const q = request.nextUrl.searchParams.get('q')?.slice(0, 200);
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', q);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10'); // Music
  url.searchParams.set('maxResults', '3');
  url.searchParams.set('key', apiKey);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return NextResponse.json({ error: 'youtube error' }, { status: 502 });
    }
    const data = await res.json();
    const videoIds = (data.items || [])
      .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
      .filter(Boolean);
    return NextResponse.json({ videoIds });
  } catch {
    return NextResponse.json({ error: 'youtube unreachable' }, { status: 502 });
  }
}
