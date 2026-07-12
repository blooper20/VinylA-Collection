import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for Aladin's ItemSearch (SearchTarget=Music) so the TTB
// key never ships in a client bundle — same reasoning/pattern as
// discogs-search/route.ts. Supplements Discogs for Korean domestic releases
// (including pre-order-only LPs) that Discogs's crowdsourced catalog hasn't
// indexed yet.
export async function GET(request: NextRequest) {
  const ttbKey = process.env.ALADIN_TTB_KEY;
  if (!ttbKey) {
    return NextResponse.json({ error: 'aladin not configured' }, { status: 500 });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const url = new URL('https://www.aladin.co.kr/ttb/api/ItemSearch.aspx');
  url.searchParams.set('ttbkey', ttbKey);
  url.searchParams.set('Query', q.slice(0, 200));
  url.searchParams.set('QueryType', 'Keyword');
  url.searchParams.set('SearchTarget', 'Music');
  url.searchParams.set('output', 'js');
  url.searchParams.set('Version', '20131101');
  url.searchParams.set('MaxResults', '20');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const items = Array.isArray(data.item)
      ? data.item.map((it: Record<string, unknown>) => ({
          itemId: it.itemId,
          title: it.title,
          author: it.author,
          pubDate: it.pubDate,
          cover: it.cover,
          stockStatus: it.stockStatus,
        }))
      : [];

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
