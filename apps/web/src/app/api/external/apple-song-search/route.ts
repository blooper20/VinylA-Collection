import { NextRequest, NextResponse } from 'next/server';

// Free-text song search against the keyless iTunes Search API — used by the
// "오노추(오늘의 노래 추천)" 글쓰기 카테고리. apple-search(entity=album)와
// 달리 여기는 entity=song이라 사용자 컬렉션이 아니라 애플뮤직 전체 카탈로그의
// 개별 트랙을 찾는다.
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get('term');
  if (!term || !term.trim()) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', term.slice(0, 200));
  url.searchParams.set('entity', 'song');
  url.searchParams.set('country', 'KR');
  url.searchParams.set('limit', '20');

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      return NextResponse.json({ error: 'itunes error' }, { status: res.status === 429 ? 429 : 502 });
    }
    const data = await res.json();
    const results = (data.results || []).map((r: any) => ({
      trackId: r.trackId,
      trackName: r.trackName || '',
      artistName: r.artistName || '',
      collectionId: r.collectionId,
      collectionName: r.collectionName || '',
      artworkUrl: typeof r.artworkUrl100 === 'string' ? r.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      releaseYear: typeof r.releaseDate === 'string' ? Number(r.releaseDate.slice(0, 4)) || undefined : undefined,
    }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'itunes unreachable' }, { status: 502 });
  }
}
