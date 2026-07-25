import { NextRequest, NextResponse } from 'next/server';

// Last-resort tracklist source for Korean-exclusive LPs that aren't on
// Discogs and are invisible to iTunes/Deezer's global catalogs. Aladin's
// own Open API (ItemSearch.aspx, used elsewhere for search/cover art) has
// no tracklist field at all — but the seller-authored product description
// on the item's detail page often does, typically under a "■ 트랙리스트"
// heading with real disc/side labels (e.g. "- A1 제목"), since it's
// describing the exact physical LP being sold.
//
// That description is lazy-loaded into the page via a separate content
// endpoint (`getContents.aspx`) keyed by the item's cover-image product
// code, not by its ItemId — and it only returns real content when the
// request carries a Referer from aladin.co.kr (confirmed by hand: a bare
// request returns 2 bytes, one with a product-page Referer returns the
// full HTML). This isn't part of Aladin's documented Open API — it's the
// same content the public product page itself loads — so treat it as a
// best-effort fallback, not a guaranteed source.

const AUTH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; VinylA/1.0)' };

interface AladinSearchItem {
  itemId: number;
  title: string;
  author: string;
  cover: string;
  isbn?: string;
}

const searchAladin = async (ttbKey: string, query: string): Promise<AladinSearchItem[]> => {
  const url = new URL('https://www.aladin.co.kr/ttb/api/ItemSearch.aspx');
  url.searchParams.set('ttbkey', ttbKey);
  url.searchParams.set('Query', query.slice(0, 200));
  url.searchParams.set('QueryType', 'Keyword');
  url.searchParams.set('SearchTarget', 'Music');
  url.searchParams.set('output', 'js');
  url.searchParams.set('Version', '20131101');
  url.searchParams.set('MaxResults', '10');

  const res = await fetch(url, { headers: AUTH_HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.item) ? data.item : [];
};

const normalize = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// Aladin cover URLs look like .../cover500/c082939700_1.jpg — the filename
// (sans the trailing "_N") is the product code `getContents.aspx` expects
// as its `ISBN` param. No extra lookup needed: we already have this URL
// from the search step.
const extractProductCode = (coverUrl: string): string | null => {
  const m = /\/([a-zA-Z0-9]+)_\d+\.\w+(?:\?.*)?$/.exec(coverUrl || '');
  return m ? m[1] : null;
};

// Parses the free-text "■ 트랙리스트" block a seller typed into the product
// description. Format is inherently seller-authored (not structured data),
// so this is best-effort: lines starting with "*" open a new disc/side
// group, lines starting with "-" are tracks, optionally led by a Discogs-
// style position ("A1", "B2"). When a listing spans multiple discs, the
// disc number is folded into `side` (e.g. "1A", "2A") so sides from
// different discs never merge in the UI's side-grouped display.
const parseAladinTracklist = (html: string): Array<{ position?: string; side?: string; title: string }> => {
  const marker = html.indexOf('트랙리스트');
  if (marker < 0) return [];

  // Stop at the next "■" section heading, or a generous cap — sellers
  // often follow the tracklist with unrelated condition/return-policy notes.
  const rest = html.slice(marker);
  const nextSection = rest.slice(1).indexOf('■');
  const block = nextSection >= 0 ? rest.slice(0, nextSection + 1) : rest.slice(0, 4000);

  const lines = block
    .split(/<BR\s*\/?>/i)
    .map((l) => l.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);

  const tracks: Array<{ position?: string; side?: string; title: string }> = [];
  let discIndex = 0;

  for (const line of lines) {
    if (line.startsWith('*')) {
      discIndex += 1;
      continue;
    }
    // Two seller conventions seen in the wild: "- A1 제목" (dash, often with
    // a Discogs-style position) and "1. 제목" / "1) 제목" (plain numbered
    // list, no side info at all).
    const trackLine = /^[-–]\s*(.+)$/.exec(line) || /^\d+[.)]\s*(.+)$/.exec(line);
    if (!trackLine) continue;

    // Sellers often tag the title track inline — strip that annotation,
    // it's not part of the song title.
    const cleaned = trackLine[1].replace(/[（(]\s*\*?\s*title\s*[)）]/i, '').trim();
    if (!cleaned) continue;

    const withPosition = /^([A-Za-z]{1,2}\d{1,2})\s+(.+)$/.exec(cleaned);
    if (withPosition) {
      const [, position, title] = withPosition;
      const letters = /^[A-Za-z]+/.exec(position)?.[0].toUpperCase() || '';
      tracks.push({ position, side: discIndex > 1 ? `${discIndex}${letters}` : letters, title });
    } else {
      tracks.push({ title: cleaned });
    }
  }

  return tracks;
};

export async function GET(request: NextRequest) {
  const ttbKey = process.env.ALADIN_TTB_KEY;
  if (!ttbKey) {
    return NextResponse.json({ tracks: [] });
  }

  const artist = request.nextUrl.searchParams.get('artist') || '';
  const title = request.nextUrl.searchParams.get('title') || '';
  if (!artist && !title) {
    return NextResponse.json({ tracks: [] });
  }

  try {
    const items = await searchAladin(ttbKey, `${artist} ${title}`.trim());
    const wantedArtist = normalize(artist);
    const wantedTitle = normalize(title);
    const match = items.find((it) => {
      const gotTitle = normalize(it.title || '');
      const gotArtist = normalize(it.author || '');
      const titleMatches = wantedTitle && (gotTitle.includes(wantedTitle) || wantedTitle.includes(gotTitle));
      const artistMatches = !wantedArtist || gotArtist.includes(wantedArtist) || wantedArtist.includes(gotArtist);
      return titleMatches && artistMatches;
    }) ?? items[0];

    if (!match) return NextResponse.json({ tracks: [] });

    const code = match.isbn || extractProductCode(match.cover);
    if (!code) return NextResponse.json({ tracks: [] });

    const contentRes = await fetch(
      `https://www.aladin.co.kr/shop/product/getContents.aspx?ISBN=${encodeURIComponent(code)}&name=Introduce&type=0&date=0`,
      {
        headers: {
          ...AUTH_HEADERS,
          Referer: `https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=${match.itemId}`,
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!contentRes.ok) return NextResponse.json({ tracks: [] });

    const html = await contentRes.text();
    const tracks = parseAladinTracklist(html);
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ tracks: [] });
  }
}
