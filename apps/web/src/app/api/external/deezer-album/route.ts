import { NextRequest, NextResponse } from 'next/server';

// Same-origin bridge to Deezer's keyless album API. Unlike the other
// /api/external/* proxies this hides no secret — Deezer just sends no CORS
// headers, so web-browser bundles can't call api.deezer.com directly
// (React Native and server contexts skip this route and go direct).
// Two read-only modes, responses trimmed to the fields core-api consumes:
//   ?q=<text>  → /search/album  (candidate albums with covers)
//   ?id=<num>  → /album/<id>    (tracklist + release date + covers)
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q');
  const id = request.nextUrl.searchParams.get('id');

  try {
    if (id && /^\d+$/.test(id)) {
      const res = await fetch(`https://api.deezer.com/album/${id}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return NextResponse.json({});
      const a = await res.json();
      if (!a || typeof a.id !== 'number') return NextResponse.json({});
      return NextResponse.json({
        id: a.id,
        title: a.title,
        artist: { name: a.artist?.name },
        cover_xl: a.cover_xl,
        cover_big: a.cover_big,
        release_date: a.release_date,
        tracks: {
          data: Array.isArray(a.tracks?.data)
            ? a.tracks.data.map((t: Record<string, unknown>) => ({ title: t.title }))
            : [],
        },
      });
    }

    if (q) {
      const url = new URL('https://api.deezer.com/search/album');
      url.searchParams.set('q', q.slice(0, 200));
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return NextResponse.json({ data: [] });
      const d = await res.json();
      const data = Array.isArray(d.data)
        ? d.data.slice(0, 5).map((a: { id: number; title?: string; artist?: { name?: string }; cover_xl?: string; cover_big?: string }) => ({
            id: a.id,
            title: a.title,
            artist: { name: a.artist?.name },
            cover_xl: a.cover_xl,
            cover_big: a.cover_big,
          }))
        : [];
      return NextResponse.json({ data });
    }

    return NextResponse.json({ data: [] });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
